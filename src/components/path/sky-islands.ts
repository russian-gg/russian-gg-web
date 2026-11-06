/*
 * The two sky-island pictures, split into a still sky and separate floating islands (generated;
 * see `docs/map-art.md` for how). For each picture: its size, the islands' sprite sheet size,
 * every island's box in the picture and its place in the sheet, and the stone circles the days
 * stand on, in trail order from the bottom, with the island each circle belongs to (0: an island
 * that crosses into the next picture and stays still).
 */
// prettier-ignore
export const SKY_ISLANDS = {
  a: {
    width: 1774,
    height: 827,
    atlas: [2048, 695],
    islands: [
      { box: [53, 409, 474, 801], at: [0, 0], centre: [237.3, 603.9], floats: true },
      { box: [1254, 29, 1642, 352], at: [423, 0], centre: [1474.2, 198.2], floats: true },
      { box: [1232, 302, 1583, 572], at: [813, 0], centre: [1413.7, 439.2], floats: true },
      { box: [418, 267, 855, 512], at: [1166, 0], centre: [610.3, 389.8], floats: true },
      { box: [465, 555, 661, 769], at: [1605, 0], centre: [554.9, 664.5], floats: true },
      { box: [565, 458, 895, 658], at: [0, 394], centre: [731.6, 558.0], floats: true },
      { box: [259, 155, 543, 336], at: [332, 394], centre: [389.8, 254.6], floats: true },
      { box: [844, 282, 1297, 458], at: [618, 394], centre: [1106.2, 378.9], floats: true },
      { box: [774, 217, 1003, 388], at: [1073, 394], centre: [902.4, 311.5], floats: true },
      { box: [953, 441, 1168, 588], at: [1304, 394], centre: [1065.2, 518.4], floats: true },
      { box: [1172, 60, 1358, 195], at: [1521, 394], centre: [1271.5, 128.5], floats: true },
      { box: [1088, 674, 1252, 808], at: [1709, 394], centre: [1169.3, 739.2], floats: true },
      { box: [156, 206, 243, 313], at: [1875, 394], centre: [198.2, 256.6], floats: true },
      { box: [765, 191, 901, 290], at: [0, 596], centre: [830.8, 243.4], floats: true },
      { box: [1476, 672, 1584, 771], at: [138, 596], centre: [1528.3, 721.2], floats: true },
      { box: [1060, 107, 1175, 193], at: [248, 596], centre: [1123.1, 148.3], floats: true },
      { box: [1588, 515, 1664, 601], at: [365, 596], centre: [1625.0, 552.0], floats: true },
      { box: [1151, 443, 1248, 528], at: [443, 596], centre: [1199.3, 482.0], floats: true },
      { box: [1180, 521, 1282, 571], at: [542, 596], centre: [1232.9, 548.3], floats: true },
    ],
    slots: [[0.502, 0.873, 0.118, 0], [0.156, 0.698, 0.109, 1], [0.349, 0.439, 0.107, 4], [0.801, 0.496, 0.111, 3], [0.829, 0.215, 0.101, 2], [0.504, 0.108, 0.096, 0]],
  },
  c: {
    width: 1774,
    height: 817,
    atlas: [2048, 592],
    islands: [
      { box: [1147, 482, 1524, 804], at: [0, 0], centre: [1332.7, 663.3], floats: true },
      { box: [1020, 233, 1420, 551], at: [379, 0], centre: [1218.4, 406.8], floats: true },
      { box: [1139, 19, 1477, 317], at: [781, 0], centre: [1319.6, 173.7], floats: true },
      { box: [423, 15, 773, 285], at: [1121, 0], centre: [579.0, 148.2], floats: true },
      { box: [1394, 222, 1651, 459], at: [1473, 0], centre: [1524.6, 338.8], floats: true },
      { box: [281, 340, 636, 573], at: [0, 324], centre: [448.6, 458.6], floats: true },
      { box: [279, 169, 503, 383], at: [357, 324], centre: [385.5, 272.6], floats: true },
      { box: [749, 21, 982, 231], at: [583, 324], centre: [861.7, 130.8], floats: true },
      { box: [965, 31, 1165, 233], at: [818, 324], centre: [1065.6, 131.2], floats: true },
      { box: [603, 311, 834, 505], at: [1020, 324], centre: [710.4, 413.8], floats: true },
      { box: [805, 313, 1033, 488], at: [1253, 324], centre: [925.2, 399.7], floats: true },
      { box: [163, 45, 311, 177], at: [1483, 324], centre: [244.4, 107.2], floats: true },
      { box: [150, 248, 230, 341], at: [1633, 324], centre: [187.6, 286.5], floats: true },
      { box: [1578, 497, 1659, 584], at: [1715, 324], centre: [1619.0, 533.4], floats: true },
      { box: [109, 719, 246, 802], at: [1798, 324], centre: [176.5, 763.4], floats: true },
      { box: [1025, 239, 1117, 288], at: [1937, 324], centre: [1075.4, 260.9], floats: true },
      { box: [860, 240, 945, 273], at: [0, 559], centre: [899.4, 256.4], floats: true },
    ],
    slots: [[0.288, 0.823, 0.111, 0], [0.732, 0.805, 0.114, 1], [0.688, 0.479, 0.107, 2], [0.258, 0.535, 0.107, 6], [0.334, 0.173, 0.101, 4], [0.731, 0.198, 0.095, 3]],
  },
} as const
