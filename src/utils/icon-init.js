/**
 * 本地图标初始化模块
 * 
 * 使用 @iconify/vue 的 addCollection() 方法，
 * 将 Material Design Icons 集合注册到本地，
 * 使 <Icon> 组件不再从网络加载图标。
 * 
 * 原理：@iconify/vue 的 Icon 组件在渲染时会先检查
 * 本地是否有已注册的图标数据，有则直接渲染 SVG，
 * 不会发起网络请求。
 */

import { addCollection } from '@iconify/vue'
import mdi from '@iconify/json/json/mdi.json'

// 注册全部 Material Design Icons 到本地
// 之后所有 <Icon icon="mdi:xxx" /> 都不会发起网络请求
addCollection(mdi)
