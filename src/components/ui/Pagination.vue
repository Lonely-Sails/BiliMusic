<template>
  <PaginationRoot
    class="pagination"
    :page="page"
    :items-per-page="pageSize"
    :total="total"
    :sibling-count="siblingCount"
    :show-edges="showEdges"
    @update:page="emit('update:page', $event)"
  >
    <PaginationList v-slot="{ items }" class="page-list">
      <PaginationFirst class="page-btn" :disabled="page <= 1">
        <Icon icon="mdi:chevron-double-left" />
      </PaginationFirst>
      <PaginationPrev class="page-btn" :disabled="page <= 1">
        <Icon icon="mdi:chevron-left" />
      </PaginationPrev>
      <template
        v-for="(item, index) in items"
        :key="item.type === 'page' ? `page-${item.value}` : `ellipsis-${index}`"
      >
        <PaginationListItem v-if="item.type === 'page'" class="page-item" :value="item.value">
          {{ item.value }}
        </PaginationListItem>
        <PaginationEllipsis v-else class="page-ellipsis">
          <Icon icon="mdi:dots-horizontal" />
        </PaginationEllipsis>
      </template>
      <PaginationNext class="page-btn" :disabled="page >= totalPages">
        <Icon icon="mdi:chevron-right" />
      </PaginationNext>
      <PaginationLast class="page-btn" :disabled="page >= totalPages">
        <Icon icon="mdi:chevron-double-right" />
      </PaginationLast>
    </PaginationList>
  </PaginationRoot>
</template>

<script setup>
/**
 * Pagination.vue — 分页组件（Reka UI 封装）
 *
 * 基于 reka-ui Pagination 二次封装，提供首页/上一页/页码/下一页/末页导航，
 * 并支持省略号折叠与边缘页码常显。
 */
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import {
  PaginationRoot,
  PaginationList,
  PaginationListItem,
  PaginationFirst,
  PaginationPrev,
  PaginationNext,
  PaginationLast,
  PaginationEllipsis,
} from 'reka-ui';

const props = defineProps({
  page: { type: Number, required: true },
  total: { type: Number, default: 0 },
  pageSize: { type: Number, default: 30 },
  /** 当前页前后显示的页码数量 */
  siblingCount: { type: Number, default: 1 },
  /** 是否恒显首页/末页与省略号 */
  showEdges: { type: Boolean, default: true },
});

const emit = defineEmits(['update:page']);

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
}

.page-btn {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all var(--transition);
  font-family: inherit;
  flex-shrink: 0;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.page-list {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-item {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  min-width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  transition: all var(--transition);
}

.page-item:hover:not([data-selected='true']) {
  border-color: var(--accent);
  color: var(--accent);
}

.page-item[data-selected='true'] {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  cursor: default;
}

.page-ellipsis {
  min-width: 20px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
