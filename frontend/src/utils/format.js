export function fmtMoney(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));
  }
  
  export function fmtNumber(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    return new Intl.NumberFormat("en-US").format(Number(n));
  }
  