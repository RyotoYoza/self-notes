import { useEffect, useRef, useState } from 'react';
import { PALETTE, useStore } from '../state/store';
import { SCHEMA_VERSION, type Category, type ImportSummary, type Lang, type Skin } from '../storage';
import { Icon } from './Icons';

export function SettingsPage() {
  const {
    t, settings, setSettings, categories, categoryLabel,
    saveCategory, createCategory, deleteCategory, runExport, runImport,
  } = useStore();

  const [result, setResult] = useState<{ ok: boolean; summary?: ImportSummary; error?: string } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const summary = await runImport(await file.text());
      setResult({ ok: true, summary });
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    e.target.value = '';
  }

  const langs: { id: Lang; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'ja', label: '日本語' },
  ];
  // The three swatches preview each palette's ground, surface and accent, so
  // the list is readable without applying every theme in turn.
  const skins: { id: Skin; label: string; note: string; sw: string[] }[] = [
    { id: 'slate', label: t.skinSlate, note: t.skinSlateNote, sw: ['#1E2228', '#30363F', '#E8A33D'] },
    { id: 'graphite', label: t.skinGraphite, note: t.skinGraphiteNote, sw: ['#0E0F13', '#20242C', '#6E6BFF'] },
    { id: 'obsidian', label: t.skinObsidian, note: t.skinObsidianNote, sw: ['#0C100E', '#1D241F', '#3DBE92'] },
    { id: 'porcelain', label: t.skinPorcelain, note: t.skinPorcelainNote, sw: ['#F4F5F7', '#FFFFFF', '#2B4FD9'] },
    { id: 'bone', label: t.skinBone, note: t.skinBoneNote, sw: ['#F2F1EC', '#FBFAF7', '#8C2F39'] },
    { id: 'system', label: t.skinSystem, note: t.skinSystemNote, sw: ['#F4F5F7', '#1E2228', '#E8A33D'] },
  ];

  return (
    <>
      <header className="head">
        <span className="head-title">
          <Icon.gear />
          <span className="nm">{t.settings}</span>
        </span>
        <span className="head-sub">{t.schemaLine(SCHEMA_VERSION)}</span>
      </header>

      <div className="settings">
        <div className="settings-inner">
          <section className="sgroup">
            <h2>{t.language}</h2>
            <div className="card">
              {langs.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`opt${settings.lang === l.id ? ' on' : ''}`}
                  onClick={() => void setSettings({ lang: l.id })}
                >
                  <span className="radio" />
                  <span className="txt"><b>{l.label}</b></span>
                </button>
              ))}
            </div>
          </section>

          <section className="sgroup">
            <h2>{t.appearance}</h2>
            <div className="card">
              {skins.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`opt${settings.skin === s.id ? ' on' : ''}`}
                  onClick={() => void setSettings({ skin: s.id })}
                >
                  <span className="radio" />
                  <span className="txt">
                    <b>{s.label}</b>
                    <span>{s.note}</span>
                  </span>
                  <span className="palprev" aria-hidden="true">
                    {s.sw.map((c) => (
                      <i key={c} style={{ background: c }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="sgroup">
            <h2>{t.manageCategories}</h2>
            <div className="card">
              {categories.map((c) => (
                <CategoryRow
                  key={c.id}
                  category={c}
                  label={categoryLabel(c)}
                  systemNote={t.systemCategory}
                  editingColor={editingColor === c.id}
                  onToggleColor={() => setEditingColor((v) => (v === c.id ? null : c.id))}
                  onSave={saveCategory}
                  onDelete={() => {
                    if (confirm(t.confirmDeleteCategory(categoryLabel(c)))) void deleteCategory(c.id);
                  }}
                  labels={{ name: t.categoryName, nameJa: t.categoryNameJa, remove: t.remove }}
                />
              ))}
              <div className="crow">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    const used = new Set(categories.map((c) => c.color));
                    const color = PALETTE.find((p) => !used.has(p)) ?? PALETTE[0];
                    void createCategory('New category', color);
                  }}
                >
                  <Icon.plus /> {t.addCategory}
                </button>
              </div>
            </div>
          </section>

          <section className="sgroup">
            <h2>{t.data}</h2>
            <p>{t.exportNote}</p>
            <div className="btnrow">
              <button type="button" className="btn" onClick={() => void runExport()}>
                {t.exportNotes}
              </button>
              <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
                {t.importNotes}
              </button>
              <input
                id="import-file"
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr"
                onChange={(e) => void onFile(e)}
              />
            </div>
            <p style={{ marginTop: 10 }}>{t.importNote}</p>

            {result?.ok && result.summary && (
              <div className="result">
                <b>{t.importDone}</b>
                <ul>
                  <li>{t.importedN(result.summary.notesImported + result.summary.categoriesImported)}</li>
                  <li>{t.skippedN(result.summary.notesSkipped + result.summary.categoriesSkipped)}</li>
                  {result.summary.notesKeptBoth + result.summary.categoriesKeptBoth > 0 && (
                    <li>{t.keptBothN(result.summary.notesKeptBoth + result.summary.categoriesKeptBoth)}</li>
                  )}
                </ul>
              </div>
            )}
            {result && !result.ok && (
              <div className="result bad">
                <b>{t.importFailed}</b>
                {result.error}
              </div>
            )}
          </section>

          <section className="sgroup">
            <h2>{t.storageStatus}</h2>
            <p>{persisted ? t.storagePersisted : t.storageNotPersisted}</p>
          </section>
        </div>
      </div>
    </>
  );
}

function CategoryRow({
  category, label, systemNote, editingColor, onToggleColor, onSave, onDelete, labels,
}: {
  category: Category;
  label: string;
  systemNote: string;
  editingColor: boolean;
  onToggleColor: () => void;
  onSave: (c: Category) => Promise<void>;
  onDelete: () => void;
  labels: { name: string; nameJa: string; remove: string };
}) {
  const [name, setName] = useState(category.name);
  const [nameJa, setNameJa] = useState(category.nameJa ?? '');

  useEffect(() => {
    setName(category.name);
    setNameJa(category.nameJa ?? '');
  }, [category.name, category.nameJa]);

  const commit = () => {
    const trimmed = name.trim() || category.name;
    if (trimmed === category.name && (nameJa.trim() || null) === category.nameJa) return;
    void onSave({ ...category, name: trimmed, nameJa: nameJa.trim() || null });
  };

  return (
    <>
      <div className="crow">
        <button
          type="button"
          className="swatch"
          style={{ background: category.color }}
          onClick={onToggleColor}
          aria-label={`${label} colour`}
        />
        {category.system ? (
          <span className="sysnote">
            <b>{label}</b> — {systemNote}
          </span>
        ) : (
          <>
            <input
              id={`cat-name-${category.id}`}
              type="text"
              value={name}
              aria-label={labels.name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commit}
            />
            <input
              id={`cat-nameja-${category.id}`}
              type="text"
              value={nameJa}
              placeholder={labels.nameJa}
              aria-label={labels.nameJa}
              onChange={(e) => setNameJa(e.target.value)}
              onBlur={commit}
            />
            <button type="button" className="iconbtn danger" onClick={onDelete} aria-label={labels.remove}>
              <Icon.trash />
            </button>
          </>
        )}
      </div>
      {editingColor && (
        <div className="swatches-pick">
          {PALETTE.map((p) => (
            <button
              key={p}
              type="button"
              className={category.color === p ? 'on' : ''}
              style={{ background: p }}
              aria-label={p}
              onClick={() => {
                void onSave({ ...category, color: p });
                onToggleColor();
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
