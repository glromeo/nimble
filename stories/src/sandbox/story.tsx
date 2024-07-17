import { Fixtures } from "./fixtures";

export function Story({
    module,
    story,
    fixture,
    spec
}: {
    module: Record<string, ()=>Node>;
    story: string;
    fixture: string | null;
    spec?: Function[];
}) {
    const titles = fixture
        ? [fixture]
        : Object.keys(module).sort((l, r) => {
              return l === "default" ? -1 : r === "default" ? 1 : l < r ? -1 : 1;
          });
    const setTitles = function () {
        console.warn("setTitles not implemented yet", ...arguments);
    };

    return <Fixtures module={module} story={story} titles={titles} onFocus={setTitles} />;
}
