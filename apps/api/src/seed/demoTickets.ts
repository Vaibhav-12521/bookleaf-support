import type { MessageType, TicketStatus } from '@bookleaf/shared';

export interface DemoTicket {
  id: string;
  authorId: string;
  bookId: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  ageHours: number;
  assignToLead?: boolean;
  thread?: { type: MessageType; body: string; ageHours: number }[];
}

export const DEMO_TICKETS: DemoTicket[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    authorId: 'AUTH003',
    bookId: 'BK005',
    subject: 'No royalty received since my book was published',
    description:
      'Between Two Temples was published in July 2024 and my dashboard shows 67 copies sold, but I have not received a single royalty payment so far. It has been well over a year. Can you please tell me what is going on and when I will be paid?',
    status: 'OPEN',
    ageHours: 70,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    authorId: 'AUTH002',
    bookId: 'BK003',
    subject: 'Amazon shows a different ISBN than my printed copy',
    description:
      'The Amazon India listing for Code & Karma shows a different ISBN from the one printed on the back cover of my author copies. Readers are asking me which one is correct. This needs to be fixed urgently.',
    status: 'OPEN',
    ageHours: 20,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    authorId: 'AUTH007',
    bookId: 'BK013',
    subject: 'How long will cover design take for Midnight in Mysore?',
    description:
      'My thriller Midnight in Mysore has been in the cover design stage for almost three weeks. I would like to plan the launch with my readers. When can I expect to see the cover and move to the next stage?',
    status: 'IN_PROGRESS',
    ageHours: 120,
    assignToLead: true,
    thread: [
      {
        type: 'INTERNAL_NOTE',
        body: 'Checked with design: second cover concept was shared on email 6 days ago, still waiting for Sneha to pick one.',
        ageHours: 100,
      },
      {
        type: 'ADMIN_REPLY',
        body:
          'Hi Sneha, thank you for checking in, and we completely understand wanting to plan your launch. Midnight in Mysore is currently in Cover Design. Our design team shared two cover concepts with you by email last week, and as soon as you let us know your preferred option we will finalise it within 2 business days and move the book into Typesetting. Could you reply with your choice (or any changes) when you get a chance?',
        ageHours: 98,
      },
      {
        type: 'AUTHOR_MESSAGE',
        body: 'Oh, I missed that email! I prefer the second concept but would like the title font to be a little bolder. Is that possible?',
        ageHours: 30,
      },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    authorId: 'AUTH005',
    bookId: 'BK008',
    subject: 'Author copies arrived with blurry images and misaligned pages',
    description:
      'I received my 20 author copies of Cardamom & Chaos yesterday. The photographs inside are blurry and several pages in the middle are misaligned. I cannot give these copies to bookstores in this condition.',
    status: 'OPEN',
    ageHours: 46,
  },
  {
    id: '00000000-0000-4000-8000-000000000005',
    authorId: 'AUTH010',
    bookId: 'BK018',
    subject: 'Howrah Nights is not available on Flipkart',
    description:
      'A few readers told me they cannot find Howrah Nights on Flipkart, only on Amazon. My other book is on Flipkart. Is this a stock problem? Please check.',
    status: 'OPEN',
    ageHours: 6,
  },
  {
    id: '00000000-0000-4000-8000-000000000006',
    authorId: 'AUTH004',
    bookId: null,
    subject: 'Can I update my author bio?',
    description:
      'I would like to update the author bio that appears on my book pages to mention my new job. Is that possible and how do I do it?',
    status: 'RESOLVED',
    ageHours: 200,
    thread: [
      {
        type: 'ADMIN_REPLY',
        body:
          'Hi Vikram, congratulations on the new role! Yes, you can update your author bio at any time. Just send us the new text by replying here or emailing the BookLeaf team, and we will update it across your listings. Changes usually show on all platforms within 3 to 5 business days.',
        ageHours: 190,
      },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000007',
    authorId: 'AUTH009',
    bookId: 'BK016',
    subject: 'Royalty for The Nagpur Notebooks not paid',
    description:
      'My dashboard says I have ₹850 pending for The Nagpur Notebooks, but nothing has been paid into my bank account. Was the payment missed?',
    status: 'OPEN',
    ageHours: 96,
  },
];
