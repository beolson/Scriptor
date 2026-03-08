import { notFound } from "next/navigation";
import { getScriptById, loadScripts } from "../../../lib/loadScripts";
import ArchBadge from "../../components/ArchBadge/ArchBadge";
import Breadcrumb from "../../components/Breadcrumb/Breadcrumb";
import DependencyTag from "../../components/DependencyTag/DependencyTag";
import InputsPanel from "../../components/InputsPanel/InputsPanel";
import MetadataRow from "../../components/MetadataRow/MetadataRow";
import ScriptViewer from "../../components/ScriptViewer/ScriptViewer";
import SpecViewer from "../../components/SpecViewer/SpecViewer";
import styles from "./detail.module.css";

interface Props {
	params: Promise<{ id: string }>;
}

export function generateStaticParams() {
	const scripts = loadScripts();
	return scripts.map((s) => ({ id: s.id }));
}

export default async function ScriptDetailPage({ params }: Props) {
	const { id } = await params;
	const scripts = loadScripts();
	const script = getScriptById(scripts, id);

	if (!script) {
		notFound();
	}

	const platformLabel = script.platform === "mac" ? "macos" : script.platform;

	return (
		<main>
			{/* Detail Header */}
			<div className={styles.detailHeader}>
				<Breadcrumb
					segments={[
						{ label: "home", href: "/" },
						{
							label: platformLabel,
							href: `/scripts/${script.platform}`,
						},
						{ label: id },
					]}
				/>
				<h1 className={styles.heading} data-testid="detail-heading">
					&gt; {id}
				</h1>
				<p className={styles.description}>
					{"// "}
					{script.description}
				</p>
				<div className={styles.badgeRow}>
					<ArchBadge arch={platformLabel} />
					<ArchBadge arch={script.arch} />
				</div>
			</div>

			{/* Detail Body */}
			<div className={styles.detailBody}>
				{/* Main Column — spec/markdown */}
				<div className={styles.mainCol}>
					<SpecViewer spec={script.spec} />
					<ScriptViewer
						scriptSource={script.scriptSource}
						scriptPath={script.script}
					/>
				</div>

				{/* Sidebar */}
				<div className={styles.sidebar}>
					{/* Metadata Card */}
					<div className={styles.metadataCard}>
						<MetadataRow label="platform" value={platformLabel} />
						<MetadataRow label="arch" value={script.arch} />
						{script.distro && (
							<MetadataRow label="distro" value={script.distro} />
						)}
						{script.version && (
							<MetadataRow label="version" value={script.version} />
						)}
					</div>

					{/* Dependencies Card */}
					{script.dependencies && script.dependencies.length > 0 && (
						<div className={styles.depsCard} data-testid="deps-card">
							<span className={styles.depsLabel}>{"// dependencies"}</span>
							<div className={styles.depsRow}>
								{script.dependencies.map((dep) => (
									<DependencyTag key={dep} dep={dep} />
								))}
							</div>
						</div>
					)}

					{/* Inputs Panel */}
					<InputsPanel inputs={script.inputs} />
				</div>
			</div>
		</main>
	);
}
