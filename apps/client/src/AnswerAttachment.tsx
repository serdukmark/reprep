import { AnswerFile } from "./api";

export function AnswerAttachment({ file }: { file?: AnswerFile }) {
  if (!file) return null;
  function download() {
    const url = URL.createObjectURL(
      new Blob([file!.content], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = file!.file_name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <details className="original">
      <summary>Файл: {file.file_name}</summary>
      <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {file.content}
      </pre>
      <button type="button" className="text-button" onClick={download}>
        Скачать TXT
      </button>
    </details>
  );
}
