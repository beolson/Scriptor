export default async function ScriptDetail({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	return <main>{id}</main>;
}
