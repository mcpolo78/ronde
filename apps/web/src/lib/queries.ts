import { graphql, type ResultOf } from "@ronde/graphql";

export const InterventionRowFragment = graphql(`
  fragment InterventionRow on Intervention {
    id
    reference
    type
    status
    priority
    scheduledStart
    scheduledEnd
    technician {
      id
      name
    }
    site {
      id
      label
      city
      latitude
      longitude
      customer {
        id
        name
      }
    }
  }
`);

export const MeQuery = graphql(`
  query Me {
    me {
      id
      name
      email
      role
    }
  }
`);

export const DashboardQuery = graphql(
  `
    query Dashboard($from: DateTime!, $to: DateTime!, $todayFrom: DateTime!, $todayTo: DateTime!) {
      dashboard(from: $from, to: $to) {
        total
        done
        inProgress
        avgOnSiteMinutes
        avgArrivalDelayMinutes
        firstTimeFixRate
      }
      today: interventions(from: $todayFrom, to: $todayTo) {
        ...InterventionRow
      }
      technicians {
        id
        name
      }
    }
  `,
  [InterventionRowFragment],
);

export const InterventionsQuery = graphql(
  `
    query Interventions(
      $from: DateTime!
      $to: DateTime!
      $status: [InterventionStatus!]
      $technicianId: ID
    ) {
      interventions(from: $from, to: $to, status: $status, technicianId: $technicianId) {
        ...InterventionRow
      }
      technicians {
        id
        name
      }
    }
  `,
  [InterventionRowFragment],
);

export const InterventionDetailQuery = graphql(`
  query InterventionDetail($id: ID!) {
    intervention(id: $id) {
      id
      reference
      type
      description
      status
      priority
      visitNumber
      report
      scheduledStart
      scheduledEnd
      technician {
        id
        name
        phone
      }
      site {
        id
        label
        address
        postalCode
        city
        accessNotes
        customer {
          id
          name
          email
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
      events {
        id
        status
        at
        author {
          name
        }
      }
    }
  }
`);

export const NewInterventionFormQuery = graphql(`
  query NewInterventionForm {
    sites {
      id
      label
      city
      customer {
        id
        name
      }
    }
    technicians {
      id
      name
    }
  }
`);

export const CreateInterventionMutation = graphql(`
  mutation CreateIntervention($input: CreateInterventionInput!) {
    createIntervention(input: $input) {
      id
      reference
    }
  }
`);

export const ScheduleInterventionMutation = graphql(`
  mutation ScheduleIntervention(
    $id: ID!
    $scheduledStart: DateTime!
    $scheduledEnd: DateTime!
    $technicianId: ID
  ) {
    scheduleIntervention(
      id: $id
      scheduledStart: $scheduledStart
      scheduledEnd: $scheduledEnd
      technicianId: $technicianId
    ) {
      id
      scheduledStart
      scheduledEnd
      technician {
        id
      }
    }
  }
`);

export const ChangeStatusMutation = graphql(`
  mutation ChangeStatus($input: ChangeStatusInput!) {
    changeStatus(input: $input) {
      id
      status
    }
  }
`);

export type InterventionRow = ResultOf<typeof InterventionRowFragment>;
export type Viewer = NonNullable<ResultOf<typeof MeQuery>["me"]>;
