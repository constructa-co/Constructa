import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuideArticleView } from '@/components/marketing/guide-article-view';
import { getAllGuideSlugs, getGuideArticle } from '@/lib/marketing-guides';

export function generateStaticParams() {
  return getAllGuideSlugs().map(slug => ({ slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const article = getGuideArticle(slug);
  if (!article) {
    return { title: 'Guide | Constructa' };
  }
  return {
    title: `${article.title} | Constructa`,
    description: article.summary,
  };
}

export default async function GuideArticlePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const article = getGuideArticle(slug);
  if (!article) notFound();
  return <GuideArticleView article={article} />;
}
