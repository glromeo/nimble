/**
 * This is a hook for esbuild to fill it with the stories loader...
 */
export async function loadStory(hash: string): Promise<Record<string, React.FC>> {
    return {} as any;
}
