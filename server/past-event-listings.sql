-- Past-event recaps supplied by Tickbox UAE x RSVP DXB.
-- Images are intentionally left empty so the team can add approved artwork in the admin dashboard.
INSERT INTO events (
  id, title, brand, venue, date, end_date, area, category, tracks, capacity,
  confirmed, ticket_price, ticket_currency, about, included, host_note, status
) VALUES
(
  'past-wcl3-2026',
  'WCL3 — World Championship of Legends 2026',
  'Tickbox UAE × RSVP DXB',
  'Dubai & Sharjah',
  '2026-10-03',
  '2026-10-18',
  'Dubai & Sharjah',
  'Sports',
  '{}',
  0,
  0,
  0,
  'AED',
  E'Cricket''s greatest names came back for one more season, and we brought the room with them.\n\nFor sixteen days, the legends of the game were back where they belong: on the pitch, under the lights, in front of a crowd that grew up watching them. WCL3 took over Dubai and Sharjah, and Tickbox UAE x RSVP DXB came on as Official PR & Inner Circle Partner to make sure the right people were in the stands, and that the whole city heard about it.\n\nWe hosted 100 creators across sports, entertainment and lifestyle, so the match-day energy travelled well beyond the stadium. More than 800 tickets went to media and influencers, filling the stands with people who would tell the story. 65 media attended the press conference, and press went out in English and Arabic. We also brought in kids as mascots and curated audience members, turning every match into a moment for families as much as for fans. Paid placements with Lovin Dubai and Gulf Buzz took the tournament to audiences who don''t usually follow cricket.',
  ARRAY['100 creators hosted across sports, entertainment and lifestyle', '800+ tickets given to media and influencers', '65 media at the press conference', 'Kids mascot programme and curated audience members', 'Bilingual press coverage in English and Arabic', 'Paid features on Lovin Dubai and Gulf Buzz'],
  'Our role: Official PR & Inner Circle Partner.',
  'closed'
),
(
  'past-rodolphe-manoukian-2026',
  'Rodolphe Manoukian Live in Dubai',
  'Lost Control × Sound Society × Empower',
  'Troy Dubai, Ramee Dream Hotel',
  '2026-09-26',
  NULL,
  'Dubai',
  'Music',
  '{}',
  0,
  0,
  0,
  'AED',
  E'Darbuka meets Afro house. One night, one percussionist, a room that didn''t stop moving.\n\nSome sets you hear, and some you feel in your chest. Rodolphe Manoukian brought his live percussion to Troy Dubai for a night that blurred the line between a performance and a ritual. Middle Eastern darbuka sat on top of Afro house, tribal rhythms and electronic beats, and the crowd moved with every hit.\n\nThe lineup held the room from doors to close: Mus, Trux, Chirag, Claire Cruz, G2, Harry, Shehzad K and Maj, each building the energy toward the headline set. Tickbox UAE x RSVP DXB ran PR end to end. We handled pre-event and post-event coverage and managed every media partner: Khaleej Times, Zee and City 1016. We also brought in 40 lifestyle creators who filled the room and the feeds. A Khaleej Times ticket giveaway got the city talking weeks before the first beat dropped.',
  ARRAY['40 lifestyle creators hosted', 'Pre-event and post-event media coverage', 'All media partners managed: Khaleej Times, Zee and City 1016', 'Khaleej Times competition: 30 tickets given away', 'Bilingual press release in English and Arabic'],
  'Our role: Tickbox UAE x RSVP DXB handled PR end to end and managed media partners.',
  'closed'
),
(
  'past-kuch-alfaaz-2026',
  'Kuch Alfaaz by Nitinn R Miranni',
  'Tickbox UAE × RSVP DXB',
  'Troy Dubai',
  '2026-10-25',
  NULL,
  'Dubai',
  'Art',
  '{}',
  0,
  0,
  0,
  'AED',
  E'Stories, poetry and music. An evening of words that stayed with you long after the last line.\n\nIn a city that moves fast, Kuch Alfaaz asked everyone to slow down and listen. Nitinn R Miranni brought his evening of storytelling, poetry and music to Troy Dubai, and for a few hours the room belonged to words: some funny, some aching, all of them landing.\n\nThe show started well before the doors opened. In the days leading up to it, Nitinn posted unfinished lines and invited his audience to complete them, a countdown that turned followers into co-writers. As PR & Inner Circle Partner, Tickbox UAE x RSVP DXB managed 30 influencers and wrote the content and copy in English and Arabic, so the evening reached both audiences in their own language. The room we curated was full of creators and culture-first tastemakers, the kind of audience that comes for the poetry and stays for the conversation after.',
  ARRAY['30 influencers managed', 'Content and copy in English and Arabic', 'Audience-led countdown series in the run-up to the show'],
  'Our role: PR & Inner Circle Partner.',
  'closed'
)
ON CONFLICT (id) DO NOTHING;
