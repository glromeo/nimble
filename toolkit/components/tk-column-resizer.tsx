import "../directives/tk-column-resizer.scss";

export type AtxColumnResizerProps = {
    toggle?: boolean;
    minWidth?: number;
    maxWidth?: number;
    placement: "left" | "right";
    factor?: number;
    edge?: boolean;
    onResize?: (width: number | string, deltaX?: number) => void;
    onMouseUp?: (width: number, deltaX: number) => void;
    container?: HTMLElement | null;
    onDoubleClick?: MouseEvent | undefined;
};

/**
 *
 * @param minWidth
 * @param placement
 * @param edge
 * @param onResize
 * @param onMouseUp
 * @param container
 * @param onDoubleClick
 * @constructor
 */
export function TkColumnResizer({
    toggle,
    minWidth = 32,
    maxWidth = Number.MAX_SAFE_INTEGER,
    placement,
    factor = 1,
    edge = false,
    onResize,
    onMouseUp,
    container,
    onDoubleClick
}: AtxColumnResizerProps) {
    return (
        <div
            ref={(instance) => {

            }}
            class={"atx-column-resizer" +" "+ placement +" "+ edge && "edge"}
            onMouseDown={(trigger) => {
                trigger.preventDefault();


                const target = trigger.target as HTMLDivElement;
                target.classList.toggle("active");

                if (!container) {
                    container = target.parentElement;
                }

                document.body.addEventListener("mousemove", dragHandler);
                document.body.addEventListener("mouseup", dragHandler);

                const initialCursor = document.body.style.cursor;
                document.body.style.cursor = "ew-resize";
                document.body.classList.add("resizing");

                const initialX = trigger.pageX;
                let width: number = container?.getBoundingClientRect().width ?? minWidth;
                let update = 0;
                let af: number = 0;

                function dragHandler({ buttons, pageX }: MouseEvent) {
                    if (buttons !== 1) {
                        document.body.removeEventListener("mousemove", dragHandler);
                        document.body.removeEventListener("mouseup", dragHandler);
                        requestAnimationFrame(function () {
                            onResize!(width + update, update);
                            target.classList.toggle("active");
                            document.body.style.cursor = initialCursor;
                            document.body.classList.remove("resizing");
                            if (onMouseUp) {
                                onMouseUp(width, update);
                            }
                        });
                    } else {
                        const deltaX = (placement === "left" ? initialX - pageX : pageX - initialX) * factor;
                        update = Math.round(Math.max(minWidth, width + deltaX) - width);
                        clearTimeout(af);
                        af = requestAnimationFrame(function () {
                            // setState(0);
                            onResize!(width + update, update);
                        });
                    }
                }
            }}
            onDoubleClick={onDoubleClick}
        >{}</div>
    );
}
