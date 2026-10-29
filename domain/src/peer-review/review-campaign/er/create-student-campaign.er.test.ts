import { describe, expect, it } from 'bun:test';
import {
  GetStreamMembersUcDef,
  StudentEvents,
} from '@u7-scl/domain/stream/contract';
import { normalize } from 'dmg-core/graph';
import { ReviewCampaignArDef } from '../review-campaign.ar';
import { ReviewCampaignEvents } from '../review-campaign.events';
import { CreateStudentCampaignErDef } from './create-student-campaign.er';

describe('CreateStudentCampaignErDef', () => {
  it('на student.completed и student.abandoned (не stream.completed); трогает кампанию; зовёт состав потока; публикует created', () => {
    expect(normalize(CreateStudentCampaignErDef)).toMatchObject({
      name: 'createStudentCampaign',
      on: ['stream.student.completed', 'stream.student.abandoned'],
      touches: ['review-campaign'],
      calls: ['getStreamMembers'],
      emits: ['peer-review.review-campaign.created'],
    });
  });

  it('on/touches/calls/emits — те же Def, что в контрактах', () => {
    expect(CreateStudentCampaignErDef.on).toEqual([
      StudentEvents.completed,
      StudentEvents.abandoned,
    ]);
    expect(CreateStudentCampaignErDef.touches).toEqual([ReviewCampaignArDef]);
    expect(CreateStudentCampaignErDef.calls).toEqual([GetStreamMembersUcDef]);
    expect(CreateStudentCampaignErDef.emits).toEqual([
      ReviewCampaignEvents.created,
    ]);
  });
});
