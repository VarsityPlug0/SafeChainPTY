import type {AdSpec} from './spec';

/** Default props for Remotion Studio previews (placeholder product, no real claims). */
export const DEMO_SPEC: AdSpec = {
  title: 'Demo',
  style: 'streetwear',
  demo: true,
  brand: {name: 'Your Brand'},
  product: {name: 'Demo Product', price: 'R299', images: []},
  cta: {text: 'Shop Now'},
  scenes: [
    {type: 'hook', duration: 2.4, text: 'Meet your *new* favourite', subtext: 'A placeholder ad for testing /brag'},
    {type: 'productReveal', duration: 3},
    {type: 'price', duration: 2.6, label: 'Only'},
    {type: 'final', duration: 4},
  ],
};
