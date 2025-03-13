import {batch, computed, signal} from "@nimble/toolkit";

const TARGET = 25;

const TriangleDemo = () => {
    const $elapsed = signal(0),
        $seconds = signal(0),
        $scale = computed(() => {
            const e = ($elapsed.value / 1000) % 10;
            return 1 + (e > 5 ? 10 - e : e) / 10;
        }),
        start = Date.now(),
        t = setInterval(() => $seconds.value = ($seconds.value % 10) + 1, 1000);

    let f: any;
    const update = () => {
        $elapsed.value = Date.now() - start;
        f = requestAnimationFrame(update);
    };
    f = requestAnimationFrame(update);

    return (
        <div
            class="container"
            style={{
                transform: "scaleX(" + $scale.value / 2.1 + ") scaleY(0.7) translateZ(0.1px)"
            }}
        >
            <Triangle x={0} y={0} s={1000} seconds={$seconds.value}/>
        </div>
    );
};

const Triangle = (props: { x: number, y: number, s: number, seconds: number }) => {
    if (props.s <= TARGET) {
        return <Dot x={props.x - TARGET / 2} y={props.y - TARGET / 2} s={TARGET} text={String(props.seconds)}/>;
    }
    const $s = computed(() => props.s / 2);

    const slow = computed(() => {
        // var e = performance.now() + 0.8;
        // // Artificially long execution time.
        // while (performance.now() < e) {
        // }
        return props.seconds;
    });

    return (
        <>
            <Triangle x={props.x} y={props.y - $s.value / 2} s={$s.value} seconds={slow.value}/>
            <Triangle x={props.x - $s.value} y={props.y + $s.value / 2} s={$s.value} seconds={slow.value}/>
            <Triangle x={props.x + $s.value} y={props.y + $s.value / 2} s={$s.value} seconds={slow.value}/>
        </>
    );
};

const Dot = (props: { x: number, y: number, s: number, text: string }) => {
    const $hover = signal(false);
    return (
        <div
            class="dot"
            style={{
                width: props.s + "px",
                height: props.s + "px",
                left: props.x + "px",
                top: props.y + "px",
                "border-radius": props.s / 2 + "px",
                "line-height": props.s + "px",
                background: $hover.value ? "#ff0" : "#61dafb"
            }}
            onMouseEnter={() => $hover.value = true}
            onMouseLeave={() => $hover.value = false}
        >{$hover.value ? "**" + props.text + "**" : props.text}</div>
    );
};

document.body.append(<TriangleDemo/>);
