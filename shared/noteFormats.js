export const noteFormats = {
  freeform: { label: 'Freeform', fields: [] },
  soap: { label: 'SOAP', fields: ['subjective', 'objective', 'assessment', 'plan'] },
};
export function emptyContent(format) {
  return format === 'freeform'
    ? { type: 'doc', content: [{ type: 'paragraph' }] }
    : Object.fromEntries(noteFormats[format].fields.map((key) => [key, '']));
}
