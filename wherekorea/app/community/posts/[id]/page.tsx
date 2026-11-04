import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { COMMUNITY_POSTS, getCommunityPost } from '@/data/community-posts'
import CommunityPost from '@/components/community/CommunityPost'

interface Props { params: Promise<{ id: string }> }

export function generateStaticParams() { return COMMUNITY_POSTS.map(post => ({ id: post.id })) }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const post = getCommunityPost(id)
  if (!post) return { title: 'Post not found', robots: { index: false, follow: false } }
  return { title: post.title, description: post.excerpt, alternates: { canonical: `/community/posts/${post.id}` } }
}

export default async function CommunityPostPage({ params }: Props) {
  const { id } = await params
  const post = getCommunityPost(id)
  if (!post) notFound()
  return <Suspense fallback={<p role="status">Loading the guide…</p>}><CommunityPost post={post} /></Suspense>
}
