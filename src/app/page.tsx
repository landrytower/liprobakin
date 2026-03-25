import HomeLoading from "./HomeLoading";
import HomeClient from "./HomeClient";
import { generateHomeArticleMetadata } from "./articleMetadata";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props) {
  return generateHomeArticleMetadata(searchParams);
}

export default function Page() {
  return (
    <>
      <div id="home-loading-shell">
        <HomeLoading />
      </div>
      <HomeClient />
    </>
  );
}
