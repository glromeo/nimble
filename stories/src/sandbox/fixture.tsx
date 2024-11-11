import React, { CSSProperties, ErrorInfo, ReactNode, useState } from "react";
import { AtxColumnResizer, AtxRowResizer } from "@atx/toolkit/components";
import { StoryContext, useStoryContext } from "./context";

// class FixtureBundary extends React.Component<
//     { story: string; children: ReactNode },
//     { error?: Error; errorInfo?: ErrorInfo }
// > {
//     constructor(props: { story: string; children: ReactNode }) {
//         super(props);
//         this.state = {};
//     }
//
//     componentDidUpdate(prevProps: Readonly<{ story: string; children: React.ReactNode }>) {
//         if (prevProps.story !== this.props.story && this.state.error) {
//             setTimeout(() => {
//                 this.setState({ error: undefined });
//             });
//         }
//     }
//
//     componentDidCatch?(error: Error, errorInfo: ErrorInfo): void {
//         this.setState({ error, errorInfo });
//     }
//
//     render() {
//         const { error, errorInfo } = this.state;
//         if (error) {
//             return (
//                 <div className="failed-story flex-column">
//                     <div>{String(error)}</div>
//                     <div>
//                         {errorInfo?.componentStack?.split(/\n/g).map((entry: string, index: number) => {
//                             const [part] = entry.split("(");
//                             return part && <div key={index}> at {`<${part.slice(7).trim()}>`}</div>;
//                         })}
//                     </div>
//                 </div>
//             );
//         }
//         return this.props.children;
//     }
// }

import "nimble/directives/resizable";

export function Fixture({
    story,
    title,
    edge,
    children
}: { story: string; title: string; edge: boolean; children: ReactNode }) {
    return (
        <div class="fixture" data-fixture={title} style="position: relative" is:resizable="bottom right">
            <StoryContext.Provider value={useStoryContext(story, title)}>{children}</StoryContext.Provider>
        </div>
    );
}
