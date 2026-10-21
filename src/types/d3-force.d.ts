// d3-force 不自带类型声明；社区包 @types/d3-force 强制 SimulationNodeDatum 泛型约束，
// 与 GraphView 现有「节点对象 + 力导回调」的写法冲突（要重写整段布局代码才能套用）。
// 这里给出最小声明，保持既有运行时行为不变：力导部分按 any 处理。
declare module "d3-force";
