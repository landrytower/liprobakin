import HomeContent from "../HomeContent";
import { generateHomeArticleMetadata } from "../articleMetadata";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props) {
  return generateHomeArticleMetadata(searchParams);
}

export default function HomePage() {
  return <HomeContent />;
}
