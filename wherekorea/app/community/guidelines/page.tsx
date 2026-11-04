import type { Metadata } from 'next'
import { CommunityNotice } from '@/components/community/CommunityNav'
import styles from '@/components/community/Community.module.css'

export const metadata: Metadata = {
  title: 'Community guidelines',
  description: 'Privacy, respectful conversation and meetup guidance for the WhereKorea community.',
  alternates: { canonical: '/community/guidelines' },
}

export default function CommunityGuidelinesPage() {
  return <div className={styles.content}>
    <p className={styles.eyebrow}>Community</p><h1 className={styles.title}>Before you share</h1><CommunityNotice />
    <article className={styles.article}>
      <h2>Keep personal details private</h2><p>Do not include phone numbers, email addresses, social handles, booking references, hotel rooms or the address of your accommodation. For a meetup draft, name a public area rather than your exact current location.</p>
      <h2>Write about what you know</h2><p>In a trip note, distinguish what happened on your visit from information that may have changed. Add the month of your visit when you know it. Leave out details you cannot confirm.</p>
      <h2>Keep the conversation useful</h2><p>Be respectful. Do not include harassment, discrimination, scams, advertisements or private information about other people. Questions can cover local travel, routes and visits to the destinations in this guide.</p>
      <h2>Meetups are not open yet</h2><p>A saved meetup draft does not create an event, contact another person or reserve a place. Public meetup requests will need acceptance and expiry controls, reporting and blocking before they open.</p>
      <h2>Your drafts stay on this browser</h2><p>Drafts are not sent to WhereKorea and are not published. They are not synced across devices. Anyone using this browser profile may be able to read them. Clearing browser data can remove them. You can remove individual drafts from My drafts.</p>
      <h2>Questions and comments are public</h2><p>When posting is available, your nickname, question or comment and its date are visible to other visitors. No Google account or email is needed to post as a guest. Preparing a browser profile does not post anything; you check your text and choose when to publish.</p>
      <h2>Keep access in the same browser</h2><p>Guest questions, reply notifications and removal controls are linked to this browser’s cookies. Clearing cookies, closing a private browsing session or changing devices loses access to managing those posts and viewing their notifications. Public posts remain visible. Guest profile recovery and account linking are not available. Anyone using this browser profile may access its questions and replies.</p><p>Replies are checked inside this website. No email or phone notification is sent. Open Replies and use Refresh to check for new comments.</p>
      <h2>Reporting, blocking and removal</h2><p>People with a browser profile can report content for spam, harassment, personal information or unsafe material. A report does not automatically remove a post. Blocking an account hides its content from your view and prevents comments between the two accounts. It does not hide public content from visitors without that browser profile.</p><p>You can remove your own questions and comments while this browser still has access to your profile. Removing a question also removes its conversation from public view. Moderators may hide content or restrict accounts that break these guidelines. Do not use this community for emergency help.</p>
      <h2>Posting limits and security checks</h2><p>Preparing a new guest profile requires a security check. Questions, comments, reports and profile changes have posting limits. A guest nickname is not verified identity, and these protections do not guarantee that every post is genuine or accurate.</p>
      <h2>Your community data</h2><p>Browser profile includes a Delete community data control for your profile, questions, comments and reports. It does not delete browser drafts or the browser identity stored by the service. Records needed to enforce a posting restriction may be retained.</p>
      <h2>Guides and traveller posts are separate</h2><p>WhereKorea team guides are labelled separately from traveller questions and comments. Neither a display name nor an account is proof of identity or the accuracy of travel information. Fares, schedules and access conditions may change; use official information for current details.</p>
    </article>
  </div>
}
