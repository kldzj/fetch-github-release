import "jest-extended";
import fs from "fs";
import path from "path";
import nock from "nock";
import tmp from "tmp";
import { downloadRelease } from "../src/downloadRelease";
import { nockServer, fileTxt, fileZip } from "./utils/nockServer";
import { GithubReleaseAsset } from "../src/interfaces";

describe("#downloadRelease()", () => {
    let tmpobj: tmp.DirResult;

    beforeEach(() => {
        nockServer();
        tmpobj = tmp.dirSync({ unsafeCleanup: true });
    });
    afterEach(() => {
        nock.cleanAll();
        tmpobj.removeCallback();
    });

    it("downloads a release", async () => {
        const check = (a: GithubReleaseAsset) =>
            a.name.indexOf("darwin-amd64") >= 0;

        await downloadRelease({
            user: "me",
            repo: "test",
            outputDir: tmpobj.name,
            filterRelease: undefined,
            filterAsset: check,
            leaveZipped: false,
            disableLogging: true,
        });

        expect(
            fs.readFileSync(path.join(tmpobj.name, "/file/file.txt"), "utf8")
        ).toEqual(fileTxt);
        expect(
            fs.readFileSync(
                path.join(tmpobj.name, "/file-darwin-amd64.txt"),
                "utf8"
            )
        ).toEqual(fileTxt);
    });

    it("returns entries list", async () => {
        const check = (a: GithubReleaseAsset) =>
            a.name.indexOf("darwin-amd64") >= 0;

        const [result] = await downloadRelease({
            user: "me",
            repo: "test",
            outputDir: tmpobj.name,
            filterAsset: check,
            disableLogging: true,
        });

        expect(result.entries).toBeArray();
    });

    it("downloads a release (without unzipping it)", async () => {
        const check = (a: GithubReleaseAsset) =>
            a.name.indexOf("darwin-amd64") >= 0;

        await downloadRelease({
            user: "me",
            repo: "test",
            outputDir: tmpobj.name,
            filterRelease: undefined,
            filterAsset: check,
            leaveZipped: true,
            disableLogging: true,
        });

        expect(
            fs
                .readFileSync(path.join(tmpobj.name, "/file-darwin-amd64.zip"))
                .toString("hex")
        ).toEqual(fileZip.toString("hex"));
        expect(
            fs.readFileSync(
                path.join(tmpobj.name, "/file-darwin-amd64.txt"),
                "utf8"
            )
        ).toEqual(fileTxt);
    });
});
