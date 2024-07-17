import { createContext, useMemo } from "react";
import { useStore } from "jotai";
import { ParametersBridge, parametersFamily } from "../hooks/parameters";

type ContextType = {
    title: string;
    parameters: ParametersBridge<any>;
};

export const StoryContext = createContext<ContextType | null>(null);

export const useStoryContext = (story: string, title: string): ContextType => {
    const store = useStore();
    return useMemo(
        () => ({
            story,
            title,
            parameters:
                (window.frameElement as any)?.parameters[title] ??
                new ParametersBridge(title, store, parametersFamily(title))
        }),
        [story, title]
    );
};
