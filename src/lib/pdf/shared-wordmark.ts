export interface PdfWordmark {
    dataUrl: string;
    aspectRatio: number;
}

/** Rasterise only the mounted shared wordmark, using its existing local font styles. */
export function captureSharedWordmark(element: HTMLElement | null, ink: readonly [number, number, number]): PdfWordmark {
    if (!element?.textContent) throw new Error("Shared wordmark is unavailable");
    const text = element.textContent;
    const style = getComputedStyle(element);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Wordmark canvas is unavailable");
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const setFont = () => {
        context.font = font;
        context.letterSpacing = style.letterSpacing;
    };
    setFont();
    const metrics = context.measureText(text);
    const size = parseFloat(style.fontSize);
    const left = Math.max(0, metrics.actualBoundingBoxLeft || 0);
    const right = Math.max(metrics.width, metrics.actualBoundingBoxRight || 0);
    const ascent = metrics.actualBoundingBoxAscent || size;
    const descent = metrics.actualBoundingBoxDescent || size / 4;
    const width = Math.ceil(left + right + 4);
    const height = Math.ceil(ascent + descent + 4);
    canvas.width = width * 3;
    canvas.height = height * 3;
    context.scale(3, 3);
    setFont();
    context.fillStyle = `rgb(${ink.join(",")})`;
    context.fillText(text, left + 2, ascent + 2);
    return { dataUrl: canvas.toDataURL("image/png"), aspectRatio: width / height };
}
