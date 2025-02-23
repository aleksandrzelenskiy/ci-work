declare module 'jspdf' {
  interface jsPDF {
    addFont: (font: string, name: string, style: string) => void;
  }
}
