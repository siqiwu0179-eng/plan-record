type Page<T> = { data: T[] | null; error: unknown; count: number | null };

/** Use an exact count and a stable, unique ordering on every page query. */
export async function loadAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  let expectedCount: number | undefined;
  while (true) {
    const { data, error, count } = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (error) throw error;
    if (count === null || (expectedCount !== undefined && count !== expectedCount)) {
      throw new Error("云端记录数量已变化或无法核对，请重新加载。为避免遗漏，本次未使用不完整数据。");
    }
    expectedCount = count;
    rows.push(...(data ?? []));
    if (rows.length === count) return rows;
    if (!data?.length || rows.length > count) {
      throw new Error("云端记录未完整读取，请重新加载。");
    }
    // Advance by the actual response length, even if the API cap is below pageSize.
  }
}
