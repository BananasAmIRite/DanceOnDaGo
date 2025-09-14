export default function normalizeSet(arr: {x: number, y: number}[][]) {
    const arrFlat = arr.flat(); 
    const minX = arrFlat.reduce((a, b) => Math.min(a, b.x), 0);
    const maxX = arrFlat.reduce((a, b) => Math.max(a, b.x), 0);
    const minY = arrFlat.reduce((a, b) => Math.min(a, b.y), 0);
    const maxY = arrFlat.reduce((a, b) => Math.max(a, b.y), 0);

    return arr.map((p) => p.map((p) => ({
        x: (p.x - minX) / (maxX - minX),
        y: (p.y - minY) / (maxY - minY)
    })));
}

export function normalizeSingle(arr: {x: number, y: number}[]) {
    const minX = arr.reduce((a, b) => Math.min(a, b.x), 0);
    const maxX = arr.reduce((a, b) => Math.max(a, b.x), 0);
    const minY = arr.reduce((a, b) => Math.min(a, b.y), 0);
    const maxY = arr.reduce((a, b) => Math.max(a, b.y), 0);

    return arr.map((p) => ({
        x: (p.x - minX) / (maxX - minX),
        y: (p.y - minY) / (maxY - minY)
    }));
}