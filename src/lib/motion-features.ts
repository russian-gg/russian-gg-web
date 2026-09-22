/**
 * Motion's DOM feature bundle, in a module of its own so the bundler can split it out.
 *
 * `MotionProvider` imports this dynamically. The indirection is the whole trick and it is not
 * optional: a static `import { domAnimation }` would put the feature code in the entry chunk,
 * which is exactly what the split is avoiding.
 *
 * `domAnimation` and not `domMax`: the larger bundle adds drag and layout projection, neither
 * of which this product uses, and it is roughly twice the size.
 */
export { domAnimation as default } from 'motion/react'
