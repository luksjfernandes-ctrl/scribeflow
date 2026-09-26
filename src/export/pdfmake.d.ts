// pdfmake 0.3 não publica tipos; o uso fica restrito ao que pdf.ts declara.
declare module 'pdfmake/build/pdfmake' {
  const pdfMake: unknown;
  export default pdfMake;
}
