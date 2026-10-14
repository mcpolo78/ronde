import { graphql, type ResultOf } from "@ronde/graphql";

export const MyDayQuery = graphql(`
  query MyDay {
    me {
      id
      name
    }
    myDay {
      id
      reference
      type
      description
      status
      priority
      scheduledStart
      scheduledEnd
      visitNumber
      report
      site {
        id
        label
        address
        postalCode
        city
        latitude
        longitude
        accessNotes
        customer {
          id
          name
          phone
        }
      }
      checklist {
        id
        label
        checked
      }
      photos {
        id
        url
        caption
      }
      signature {
        signerName
        signedAt
        url
      }
    }
  }
`);

export const ChangeStatusMutation = graphql(`
  mutation MobileChangeStatus($input: ChangeStatusInput!) {
    changeStatus(input: $input) {
      id
    }
  }
`);

export const ToggleChecklistMutation = graphql(`
  mutation MobileToggleChecklist($id: ID!, $checked: Boolean!) {
    toggleChecklistItem(id: $id, checked: $checked) {
      id
    }
  }
`);

export const AddPhotoMutation = graphql(`
  mutation MobileAddPhoto($input: AddPhotoInput!) {
    addPhoto(input: $input) {
      id
    }
  }
`);

export const SignMutation = graphql(`
  mutation MobileSign($input: SignInterventionInput!) {
    signIntervention(input: $input) {
      id
    }
  }
`);

export const SaveReportMutation = graphql(`
  mutation MobileSaveReport($interventionId: ID!, $report: String!) {
    saveReport(interventionId: $interventionId, report: $report) {
      id
    }
  }
`);

export type DayIntervention = ResultOf<typeof MyDayQuery>["myDay"][number];
