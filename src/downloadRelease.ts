import os from "os";
import fs from "fs";
import path from "path";
import extract from "extract-zip";
import { getReleases } from "./getReleases";
import { getLatest } from "./getLatest";
import { download } from "./download";
import { rpad } from "./rpad";
import { GithubRelease, GithubReleaseAsset } from "./interfaces";

function pass() {
    return true;
}

const MultiProgress = require("multi-progress");

interface DownloadOptions {
    user: string;
    repo: string;
    outputDir: string;
    filterRelease?: ReleaseFilter;
    filterAsset?: AssetFilter;
    leaveZipped?: boolean;
    disableLogging?: boolean;
}

type DownloadResult<O extends DownloadOptions> = {
    destf: string;
    release: GithubRelease;
} & (O["leaveZipped"] extends false ? { entries: string[] } : {});

type ReleaseFilter = (release: GithubRelease) => boolean;
type AssetFilter = (asset: GithubReleaseAsset) => boolean;

/**
 * Download a specific github release
 * @param user The name of the github user or organization
 * @param repo The name of the github repository
 * @param outputDir The directory to write the release to
 * @param filterRelease Optionally filter the release
 * @param filterAsset Optionally filter the asset for a given release
 * @param leaveZipped Optionally leave the file zipped
 * @param disableLogging Optionally disable logging for quiet output
 */
export async function downloadRelease<O extends DownloadOptions>({
    user,
    repo,
    outputDir,
    filterRelease = pass,
    filterAsset = pass,
    leaveZipped = false,
    disableLogging = false,
}: O): Promise<DownloadResult<O>[]> {
    if (!user) {
        throw new Error("Missing user argument");
    }
    if (!repo) {
        throw new Error("Missing user argument");
    }
    const bars = new MultiProgress(process.stderr);

    const releases = await getReleases(user, repo);
    const release = getLatest(releases, filterRelease, filterAsset);
    if (!release) {
        throw new Error(
            `Could not find a release for ${user}/${repo} (${os.platform()} ${os.arch()})`
        );
    }

    if (!disableLogging) {
        console.error(`Downloading ${user}/${repo}@${release.tag_name}...`);
    }

    const promises = release.assets.map(
        async (asset): Promise<DownloadResult<O>> => {
            let progress;

            if (process.stdout.isTTY && !disableLogging) {
                const bar = bars.newBar(`${rpad(asset.name, 24)} :bar :etas`, {
                    complete: "▇",
                    incomplete: "-",
                    width: process.stdout.columns - 36,
                    total: 100,
                });
                progress = bar.update.bind(bar);
            }

            // eslint-disable-next-line no-param-reassign
            outputDir = path.isAbsolute(outputDir)
                ? outputDir
                : path.resolve(outputDir);

            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir);
            }

            if (!fs.statSync(outputDir).isDirectory()) {
                throw new Error(
                    `Output path "${outputDir}" must be a directory`
                );
            }

            let entries: string[] = [];
            const destf = path.join(outputDir, asset.name);
            if (!fs.existsSync(destf)) {
                const dest = fs.createWriteStream(destf);

                await download(asset.url, dest, progress);
                if (!leaveZipped && /\.zip$/.exec(destf)) {
                    await extract(destf, {
                        dir: outputDir,
                        onEntry(entry) {
                            entries.push(entry.fileName);
                        },
                    });
                    fs.unlinkSync(destf);
                }
            }

            if (leaveZipped) {
                return { destf, release } as DownloadResult<O>;
            }

            return { destf, release, entries };
        }
    );
    return Promise.all(promises);
}
