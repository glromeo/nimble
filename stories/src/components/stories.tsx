import { Navigator } from "./navigator";
import { StoryParameters } from "./tabs/story-parameters";
import { Jasmine } from "./tabs/jasmine";
import { useSettings } from "../hooks/settings";
import { IFrame } from "./iframe";
import {JSX} from "@nimble/toolkit";
import {Signal} from "@nimble/toolkit/signals/signals";

import "./stories.scss";

const tabIndexAtom = atom<number | null>(null);
const tabAtom = atom(
    (get) => get(tabIndexAtom) ?? parseInt(localStorage.getItem("atx-stories.details-tab") ?? "0"),
    (get, set, value: number) => {
        localStorage.setItem("atx-stories.details-tab", String(value));
        set(tabIndexAtom, value);
    }
);

export function Stories({ stories }: { stories: Signal<Record<string, string[]>> }):JSX.Element {
    const ref = useRef(null);
    const [story, setStory] = useState(() => location.hash.slice(2));
    const [titles, setTitles] = useState<string[]>(() => {
        const fixture = new URLSearchParams(location.search).get("fixture");
        return fixture ? [fixture] : stories[story] ?? [];
    });

    useEffect(() => {
        const url = new URL(location.href);
        if (story) {
            url.hash = `#/${story}`;
        }
        if (titles.length === 1) {
            url.searchParams.set("fixture", titles[0]);
        }
        history.replaceState({}, "", url);
    }, [story, titles]);

    const [settings, updateSettings] = useSettings();

    return (
        <div class="stories" ref={ref}>
            <NavigatorPane>
                <Navigator
                    stories={stories}
                    selected={story}
                    defaultOpen={true}
                    titles={titles}
                    onSelect={(selected) => {
                        setStory(selected);
                        if (selected !== story) {
                            setTitles(stories[selected]);
                        } else {
                            setTitles([]);
                        }
                    }}
                    onFocus={setTitles}
                />
            </NavigatorPane>
            <div class="flex-column flex-grow">
                <IFrame story={story} titles={titles} />
                <AtxResizablePane
                    class="details"
                    resizer="top"
                    style={{ height: settings.layout.bottom ?? 300 }}
                    onResize={({ height }) => {
                        updateSettings({ layout: { bottom: height } }, false);
                    }}
                >
                    <AtxTabbedPane state={useAtom(tabAtom)}>
                        <StoryParameters tab-title="Parameters" story={story} titles={titles} />
                        <Jasmine tab-title="Tests" story={story} />
                    </AtxTabbedPane>
                </AtxResizablePane>
            </div>
        </div>
    );
}

function NavigatorPane({ children }: { children: ReactNode }) {
    const [{ layout }, updateSettings] = useSettings();
    return (
        <div class="navigator-pane" style={{ width: layout.left ?? 200 }}>
            {children}
            <AtxColumnResizer
                placement="right"
                minWidth={200}
                onResize={(width) => updateSettings({ layout: { left: width } }, false)}
            />
        </div>
    );
}
