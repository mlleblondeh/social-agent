module.exports = {
  batchMode: 'weekly',  // 'daily' or 'weekly'

  weekStart: 'monday',

  posting: {
    maxPerDay: 4,
    preferredTimes: ['09:00', '12:00', '18:00'],  // EST, for your reference
    platforms: ['instagram', 'tiktok', 'threads']
  },

  postingTimes: {
    tiktok: ['11:00', '15:00', '19:00'],     // EST - best engagement times
    instagram: ['09:00', '12:00', '18:00'],
    threads: ['10:00', '14:00', '20:00']     // EST - conversational times
  },

  paths: {
    contentDir: '../../output/content',
    imagesDir: '../../output/images',
    mediaDir: '../../output/media',
    outputDir: './output/ready-to-post'
  }
};
