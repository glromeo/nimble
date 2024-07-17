import React, { useCallback, useMemo, useState } from "react";
import { LuCircle, LuFile, LuFolder, LuFolderOpen } from "react-icons/lu";
import { MdRefresh } from "react-icons/md";

import "./navigator.scss";

const storiesComparator = (l: String, r: string): number => {
    return l === "default" ? -1 : r === "default" ? 1 : l < r ? -1 : 1;
};

export function Navigator(props: {
    stories: Record<string, string[]>;
    selected: string;
    defaultOpen?: boolean;
    titles: string[];
    onSelect: (story: string) => void;
    onFocus: (titles: string[]) => void;
}) {
    const { stories, selected, defaultOpen, titles, onSelect, onFocus } = props;

    const [isOpen, setOpen] = useState<Record<string, boolean>>({});

    const root = useMemo(() => {
        const root: Node = {
            label: "stories",
            value: "/",
            children: []
        };
        for (const story of Object.keys(stories).sort()) {
            let node = root;
            let value = "";
            main: for (const part of story.split(/\//g)) {
                value += `/${part}`;
                if (node.children) {
                    for (const child of node.children)
                        if (child.label === part) {
                            node = child;
                            continue main;
                        }
                }
                const child = {
                    label: part,
                    value: value.slice(1)
                };
                node.children = node.children ? [...node.children, child] : [child];
                node = child;
            }
        }
        return root;
    }, [stories]);

    let key: number = 0;

    const renderNode = useCallback(
        ({ label, value, children }: Node, indent: number): JSX.Element[] => {
            if (children) {
                if (defaultOpen && !(value in isOpen)) {
                    isOpen[value] = true;
                }
                let nodes = [
                    <TreeNode
                        key={key++}
                        indent={indent}
                        label={label}
                        isOpen={isOpen[value]}
                        selected={selected === value}
                        onClick={() => setOpen({ ...isOpen, [value]: !isOpen[value] })}
                    />
                ];
                if (isOpen[value]) {
                    for (const child of children) {
                        nodes = [...nodes, ...renderNode(child, indent + 1)];
                    }
                }
                return nodes;
            } else {
                let nodes = [
                    <FileNode
                        key={key++}
                        indent={indent}
                        label={label}
                        selected={selected === value}
                        onClick={() => {
                            onSelect(value);
                            onFocus(stories[value]);
                        }}
                    />
                ];
                if (value === selected) {
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
        },
        [root, isOpen, selected, titles]
    );

    return <div className="navigator">{useMemo(() => renderNode(root, 0), [renderNode, root])}</div>;
}

type Node = {
    label: string;
    value: string;
    children?: Node[];
};

export function TreeNode(props: {
    label: string;
    isOpen: boolean;
    selected: boolean;
    indent?: number;
    onClick: () => void;
}) {
    const { label, isOpen, selected, indent = 0, onClick } = props;
    const icon = isOpen ? <LuFolderOpen /> : <LuFolder />;
    return (
        <div
            className="navigator-item node"
            data-selected={selected}
            style={{ paddingLeft: 4 + indent * 12 }}
            onClick={onClick}
        >
            {icon} {label.toLowerCase().replace(/[_-]/g, " ")}
        </div>
    );
}

export function FileNode(props: { label: string; selected: boolean; indent?: number; onClick: () => void }) {
    const { label, selected, indent = 0, onClick } = props;
    return (
        <div
            className="navigator-item file"
            data-selected={selected}
            style={{ paddingLeft: 4 + indent * 12 }}
            onClick={onClick}
        >
            {<LuFile />} {label.toLowerCase().slice(0, label.indexOf(".stories.")).replace(/[_-]/g, " ")}
        </div>
    );
}

function StoryNode(props: {
    name: string;
    focused: boolean;
    indent: number;
    onClick: (action: "item" | "reload") => void;
}) {
    const { name, focused, indent, onClick } = props;
    return (
        <div
            className="navigator-item story"
            data-name={name}
            data-selected={focused}
            style={{ paddingLeft: 16 + indent * 12 }}
            onClick={() => onClick("item")}
        >
            <LuCircle />
            <span className="label">{name.toLowerCase().replace(/[_-]/g, " ")}</span>
            <MdRefresh
                onClick={(e) => {
                    onClick("reload");
                    e.stopPropagation();
                }}
            />
        </div>
    );
}
