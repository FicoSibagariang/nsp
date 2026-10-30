import { Table as BaseTable, type TableProps } from '@astryxdesign/core/Table';
import type { ReactElement } from 'react';

export function Table<T extends Record<string, unknown>>(props: TableProps<T>): ReactElement {
  return <BaseTable {...props} />;
}

export type { TableColumn, TableProps } from '@astryxdesign/core/Table';

