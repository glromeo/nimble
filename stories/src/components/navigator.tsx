import "./navigator.scss";
import {computed, JSX, signal, Signal} from "@nimble/toolkit";

const storiesComparator = (l: String, r: string): number => {
    return l === "default" ? -1 : r === "default" ? 1 : l < r ? -1 : 1;
};

export function Navigator(props: {
    defaultOpen?: boolean;
    stories: Record<string, string[]>;
    titles: string[];
    $selected: Signal<string>;
    $focused: Signal<string[]>;
}) {
    const {
        defaultOpen = false,
        $selected,
        $focused
    } = props;

    const $root = computed(() => {
        const root: Node = {
            label: "stories",
            path: "/",
            children: []
        };
        for (const story of Object.keys(props.stories).sort()) {
            let node = root;
            let path = "";
            main: for (const part of story.split(/\//g)) {
                path += `/${part}`;
                if (node.children) {
                    for (const child of node.children) {
                        if (child.label === part) {
                            node = child;
                            continue main;
                        }
                    }
                }
                const child = {
                    label: part,
                    path: path.slice(1),
                    children: undefined
                };
                if (node.children) {
                    node.children.push(child);
                } else {
                    node.children = [child];
                }
                node = child;
            }
        }
        return root;
    });

    const onFileClick = (path: string) => {
        $selected.set(path);
        $focused.set(props.stories[path]);
    };

    function TreeFragment(props: {
        node: Node,
        indent: number
    }) {
        const {indent} = props;
        const $isOpen = signal(defaultOpen);
        return <>
            <div
                class="navigator-item node"
                is-selected={$selected.is(props.node.path)}
                is-open={$isOpen.get()}
                style={() => `padding-left: ${4 + indent * 12}`}
                onClick={() => $isOpen.set(!$isOpen.get())}
            >
                {$isOpen.get() ? <LuFolderOpen/> : <LuFolder/>} {props.node.label.toLowerCase().replace(/[_-]/g, " ")}
            </div>
            {$isOpen.peek() && props.node.children?.map(child => <TreeFragment node={child} indent={indent + 1}/>)}
        </>;
    }

    const renderTree = (): JSX.Element => {
        let nodes;
        if (children) {
            return (
                <TreeNode
                    label={label}
                    path={path}
                    indent={indent}
                    children={children}
                />
            );
        } else {
            nodes = [
                <FileNode
                    indent={indent}
                    label={label}
                    path={path}
                    $selected={$selected}
                    onClick={onFileClick}
                />
            ];
            if (path === selected) {
                nodes = [
                    ...nodes,
                    ...stories[selected].sort(storiesComparator).map((name) => {
                        const focused = titles.includes(name);
                        return (
                            <StoryNode
                                key={name}
                                name={name}
                                focused={focused}
                                indent={indent}
                                onClick={(action) => {
                                    if (action === "reload") {
                                        onFocus([name]);
                                    } else {
                                        onFocus(focused && titles.length === 1 ? stories[selected] : [name]);
                                    }
                                }}
                            />
                        );
                    })
                ];
            }
            return nodes;
        }
    };

    return (
        <div class="navigator">
            <TreeFragment node={$root.get()} indent={0}/>
        </div>
    );
}

type Node = {
    label: string;
    path: string;
    children?: Node[];
};

export function FileNode(props: {
    label: string;
    path: string;
    $selected: Signal<string>;
    indent?: number;
    onClick: (path: string) => void
}) {
    const {label, path, $selected, indent = 0, onClick} = props;
    return computed(() => (
        <div
            class="navigator-item file"
            data-selected={$selected.is(path)}
            style={{paddingLeft: 4 + indent * 12}}
            onClick={() => onClick(path)}
        >
            {<LuFile/>} {label.toLowerCase().slice(0, label.indexOf(".stories.")).replace(/[_-]/g, " ")}
        </div>
    ));
}

function StoryNode(props: {
    name: string;
    focused: boolean;
    indent: number;
    onClick: (action: "item" | "reload") => void;
}) {
    const {name, focused, indent, onClick} = props;
    return (
        <div
            class="navigator-item story"
            data-name={name}
            data-selected={focused}
            style={{paddingLeft: 16 + indent * 12}}
            onClick={() => onClick("item")}
        >
            <LuCircle/>
            <span class="label">{name.toLowerCase().replace(/[_-]/g, " ")}</span>
            <MdRefresh
                onClick={(e) => {
                    onClick("reload");
                    e.stopPropagation();
                }}
            />
        </div>
    );
}
