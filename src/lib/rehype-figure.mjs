/**
 * Turns a paragraph that holds only an image with a title into a figure:
 *
 *   ![alt text](./plot.png "Caption shown under the image")
 *
 * becomes <figure><img alt="alt text" …><figcaption>Caption…</figcaption></figure>.
 */
export default function rehypeFigure() {
  return (tree) => visit(tree);
}

function visit(node) {
  if (!node.children) return;
  node.children = node.children.map((child) => {
    if (child.type === 'element' && child.tagName === 'p') {
      const content = child.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
      const img = content[0];
      if (content.length === 1 && img.type === 'element' && img.tagName === 'img' && img.properties?.title) {
        const caption = String(img.properties.title);
        delete img.properties.title;
        return {
          type: 'element',
          tagName: 'figure',
          properties: {},
          children: [img, { type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: caption }] }],
        };
      }
    }
    visit(child);
    return child;
  });
}
