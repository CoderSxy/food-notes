import EntryForm from "@/components/EntryForm";
export default function NewEntry() {
  return (
    <>
      <div className="narrow page-intro">
        <h1>增加记录</h1>
        <p className="muted">收藏餐饮，也记下喜欢的物品。</p>
      </div>
      <EntryForm />
    </>
  );
}
