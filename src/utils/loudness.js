/** 音量均衡器 — createMediaElementSource → GainNode → Compressor → AnalyserNode */

const RMS_TARGET = 0.08
const MAX_GAIN = 5.0
const MIN_GAIN = 0.25
const ANALYSIS_SAMPLES = 40
const SILENCE_THRESHOLD = 0.015

// 轻量压缩参数
const COMPRESSOR = {
	threshold: -18, knee: 16, ratio: 8,
	attack: 0.005, release: 0.15,
}

const gainCache = new Map()

export function getCachedGain(songKey) { return gainCache.get(songKey) ?? null }
export function clearGainCache() { gainCache.clear() }

export class LoudnessNormalizer {
	constructor(audioElement) {
		this.audioElement = audioElement
		this.ctx = null
		this.gainNode = null
		this.compressor = null
		this.analyser = null
		this._gain = 1
		this._lastVolume = 1
		this._timer = null
		this._active = false
		this._ready = false
		this._songKey = ''
	}

	get gain() { return this._gain }
	get ready() { return this._ready }

	init() {
		if (this._ready) return
		try {
			this.ctx = new AudioContext()
			const source = this.ctx.createMediaElementSource(this.audioElement)
			this.gainNode = this.ctx.createGain()
			this.compressor = this.ctx.createDynamicsCompressor()
			this.compressor.threshold.value = COMPRESSOR.threshold
			this.compressor.knee.value = COMPRESSOR.knee
			this.compressor.ratio.value = COMPRESSOR.ratio
			this.compressor.attack.value = COMPRESSOR.attack
			this.compressor.release.value = COMPRESSOR.release
			this.analyser = this.ctx.createAnalyser()
			this.analyser.fftSize = 256
			source.connect(this.gainNode)
			this.gainNode.connect(this.compressor)
			this.compressor.connect(this.analyser)
			this.analyser.connect(this.ctx.destination)
			this._ready = true
		} catch (e) {
			console.warn('[Loudness] Init failed:', e.name, e.message)
		}
	}

	async fadeTo(target, duration = 200) {
		return new Promise(resolve => {
			if (!this.gainNode) { resolve(); return }
			const now = this.ctx.currentTime
			this.gainNode.gain.cancelScheduledValues(now)
			this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now)
			this.gainNode.gain.linearRampToValueAtTime(target, now + duration / 1000)
			setTimeout(resolve, duration)
		})
	}

	async fadeOut(duration = 250) { return this.fadeTo(0, duration) }

	async enable(userVolume, songKey) {
		if (!this._ready) return
		this._active = true
		this._gain = 1
		this._lastVolume = userVolume
		this._songKey = songKey || ''
		if (this.ctx.state === 'suspended') await this.ctx.resume()
		this.audioElement.volume = 1
		if (songKey && gainCache.has(songKey)) {
			this._gain = gainCache.get(songKey)
			console.log(`[Loudness] Cached gain=${this._gain.toFixed(2)}x for ${songKey}`)
			this.applyGain()
			return
		}
		await this.fadeTo(userVolume, 200)
		this.startAnalysis()
	}

	async disable(userVolume) {
		this._active = false
		this._lastVolume = userVolume
		clearTimeout(this._timer)
		this._gain = 1
		this.audioElement.volume = 1
		await this.fadeTo(userVolume, 200)
	}

	setUserVolume(userVolume) {
		this._lastVolume = userVolume
		this._active
			? this.fadeTo(userVolume * this._gain, 150)
			: this.fadeTo(userVolume, 150)
	}

	destroy() {
		this._active = false
		this._ready = false
		clearTimeout(this._timer)
		try {
			this.gainNode?.disconnect()
			this.compressor?.disconnect()
			this.analyser?.disconnect()
			this.ctx?.close()
		} catch {}
		this.gainNode = null
		this.compressor = null
		this.analyser = null
		this.ctx = null
		this._gain = 1
	}

	applyGain() {
		if (!this._active) return
		this.fadeTo(this._lastVolume * this._gain, 500)
	}

	startAnalysis() {
		this.rmsSamples = []
		this.peakSamples = []
		let count = 0
		const buffer = new Uint8Array(this.analyser.frequencyBinCount)
		const tick = () => {
			if (!this._active || count >= ANALYSIS_SAMPLES) { this.finishAnalysis(); return }
			this.analyser.getByteTimeDomainData(buffer)
			let sum = 0
			let peak = 0
			for (let i = 0; i < buffer.length; i++) {
				const v = (buffer[i] - 128) / 128
				sum += v * v
				const absValue = Math.abs(v)
				if (absValue > peak) peak = absValue
			}
			this.rmsSamples.push(Math.sqrt(sum / buffer.length))
			this.peakSamples.push(peak)
			count++
			this._timer = setTimeout(tick, 100)
		}
		tick()
	}

	finishAnalysis() {
		const nonSilent = this.rmsSamples.filter(s => s > SILENCE_THRESHOLD)
		if (nonSilent.length < 3) {
			console.log('[Loudness] Insufficient audio data, keeping gain=1')
			return
		}
		const mid = arr => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)]
		const medianRMS = mid(nonSilent)
		// 取对应非静音样本的峰值
		const peakValues = this.peakSamples.filter((_, i) => this.rmsSamples[i] > SILENCE_THRESHOLD)
		const medianPeak = mid(peakValues)
		const crestFactor = medianPeak / Math.max(medianRMS, 0.001)
		let computedGain = RMS_TARGET / Math.max(medianRMS, 0.001)
		// CF 修正：高动态 → 降低增益防削波
		computedGain *= Math.pow(0.85, crestFactor - 3)
		// 峰值保护
		if (medianPeak * computedGain > 1.0)
			computedGain = 1.0 / medianPeak
		this._gain = Math.max(MIN_GAIN, Math.min(MAX_GAIN, computedGain))
		if (this._songKey) gainCache.set(this._songKey, this._gain)
		console.log(`[Loudness] RMS=${medianRMS.toFixed(4)} Pk=${medianPeak.toFixed(4)} CF=${crestFactor.toFixed(1)} gain=${this._gain.toFixed(2)}x${this._songKey ? ' cached' : ''}`)
		this.applyGain()
	}
}
