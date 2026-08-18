// 稳定散列：同一篇文章每次构建得到同一封面构图变体（0/1/2）
export function coverVariant(id: string): number {
  const h = [...id].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) % 97, 7);
  return ((h % 3) + 3) % 3;
}
