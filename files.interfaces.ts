export default interface modelFile {
  fileId: string;
  name: string;
  path: string;
  hash: string;
  size: number;
  privacy: "public" | "private";
  isDownloaded: "not_downloaded" | "downloaded" | "downloading";
  isSync: "synchronized" | "synchronizing" | "unsynchronized";
}
