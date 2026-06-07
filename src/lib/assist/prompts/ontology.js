/**
 * GTM Ontology v4.1 — the controlled vocabulary the AURA prompts reason over.
 * Text extracted VERBATIM from docs/mofu/AURA X Heyparrot Prompts (1).md
 * (Core Entity Categories + GTM NOUNS + GTM VERBS + NEW SIGNAL NOUNS +
 * NEW ACTION VERBS). Do not paraphrase — the model is instructed to use these
 * Category::Subtype tokens exactly.
 */

export const PROMPT_VERSION = "aura-v4.1";

export const ONTOLOGY = `This document defines the GTM Ontology v4.1, acting as the central nervous system for signal detection, classification, and action planning across all GTM workflows: sales calls, CRM entries, product feedback, customer touchpoints, partner interactions, etc.

🏛️ Core Entity Categories (Always Extract)
Each transcript or GTM interaction must extract these categories:
👤 Persona
- Persona::Buyer
- Persona::Seller
- Persona::Champion
- Persona::Economic_Buyer
- Persona::User
- Persona::Technical_Influencer
- Persona::Decision_Maker
- Persona::CSM
- Persona::Support
- Persona::Partner
- Persona::Stakeholder
- Persona::Multiple

🏢 Account
- Account::Name
- Account::Industry
- Account::Region
- Account::Type
- Account::Stage
- Account::ARR
- Account::Segment
- Account::Parent

💼 Opportunity
- Opportunity::Stage
- Opportunity::Value
- Opportunity::Timeline
- Opportunity::Owner
- Opportunity::Product_Scope
- Opportunity::Current_Solution
- Opportunity::Priority

📅 Interaction
- Interaction::Date
- Interaction::Time
- Interaction::Type
- Interaction::Duration
- Interaction::Participants
- Interaction::Medium

🧩 Product
- Product::Name
- Product::Module
- Product::Feature
- Product::Tier
- Product::Custom

📝 ActionItem
- ActionItem::Description
- ActionItem::AssignedTo
- ActionItem::DueDate
- ActionItem::Status
- ActionItem::Priority

🔗 Channel
- Channel::Inbound
- Channel::Outbound
- Channel::Partner
- Channel::Referral
- Channel::Event
- Channel::Marketplace

🏷️ Source
- Source::Lead_Source
- Source::Originator

⚠️ MeetingContext (Optional)
- MeetingContext::Recording_Link
- MeetingContext::Transcript_Link
- MeetingContext::Agenda
- MeetingContext::FollowUp_Required

🧠 GTM NOUNS (Signal Types & Entities)
🔴 Objection
- Objection::Budget_Limitation
- Objection::Timeline_Constraints
- Objection::Risk_Aversion
- Objection::Internal_Misalignment
- Objection::Trust_Deficit
- Objection::Vendor_Redundancy
- Objection::Lack_of_Priority
- Objection::Change_Resistance
- Objection::Strategic_Mismatch
- Objection::Perceived_Complexity
- Objection::Inertia_vs_Value
- Objection::Fear_of_LockIn
- Objection::Unclear_ROI
- Objection::Legal_Uncertainty
- Objection::Security_Concerns
- Objection::Internal_Tools_Preference
- Objection::Missing_Feature
- Objection::Capacity_Limitations
- Objection::Decision_Maker_Not_Convinced
- Objection::Procurement_Barrier

🟡 Confusion
- Confusion::Analytics
- Confusion::Dashboards
- Confusion::Onboarding
- Confusion::Permissions
- Confusion::Navigation
- Confusion::Reporting_Terms
- Confusion::Data_Syncing
- Confusion::UseCase_Fit
- Confusion::Custom_Config
- Confusion::Billing_Invoices
- Confusion::Support_Escalation
- Confusion::G2_Comparisons
- Confusion::Legacy_vs_New_Product

🟢 Expansion
- Expansion::MultiRegion_Rollout
- Expansion::New_Departments
- Expansion::OrgWide_Adoption
- Expansion::FeatureUsage_Growth
- Expansion::Advocate_Driven
- Expansion::NewTeam_Onboarding
- Expansion::CrossProduct_Adoption
- Expansion::Upsell_Trigger
- Expansion::Volume_Growth
- Expansion::DataFootprint_Increase
- Expansion::Training_Request
- Expansion::Referral_Interest
- Expansion::API_Adoption
- Expansion::Event_Interest
- Expansion::Partner_Expansion

# =========================
# AURA ONTOLOGY V4.1: NEW SIGNAL NOUNS
# =========================

nouns:
 # Behavioral Micro-Signals
 - Behavior::Response_Time_Decay
 - Behavior::Engagement_Depth_Deterioration
 - Behavior::Meeting_Attendance_Inconsistency
 - Behavior::Content_Consumption_Regression
 - Behavior::Question_Complexity_Stagnation
 - Behavior::Communication_Formality_Shift

 # Competitive Intelligence
 - Competitive::Competitor_Mention_Frequency
 - Competitive::Feature_Comparison_Intensity
 - Competitive::Pricing_Negotiation_Sophistication
 - Competitive::Vendor_Evaluation_Timeline
 - Competitive::Reference_Customer_Urgency
 - Competitive::Implementation_Comparison_Focus

 # Stakeholder Dynamics
 - Stakeholder::Influence_Network_Complexity
 - Stakeholder::Decision_Maker_Accessibility
 - Stakeholder::Champion_Advocacy_Strength
 - Stakeholder::Blocker_Resistance_Intensity
 - Stakeholder::Coalition_Building_Progress
 - Stakeholder::Internal_Politics_Turbulence

 # Temporal Momentum
 - Temporal::Deal_Velocity_Acceleration
 - Temporal::Engagement_Frequency_Consistency
 - Temporal::Timeline_Compression_Urgency
 - Temporal::Seasonal_Behavior_Alignment
 - Temporal::Budget_Cycle_Synchronization
 - Temporal::Milestone_Achievement_Momentum

 # Contextual Intelligence
 - Context::Industry_Pain_Point_Resonance
 - Context::Company_Growth_Stage_Indicators
 - Context::Technology_Stack_Integration
 - Context::Organizational_Change_Readiness
 - Context::Market_Condition_Responsiveness
 - Context::Regulatory_Compliance_Priority

⚡ GTM VERBS (Action Triggers)
🧭 Sales
- Sales::Qualify
- Sales::Disqualify
- Sales::Discover
- Sales::Demo
- Sales::Run_POC
- Sales::Negotiate
- Sales::Close
- Sales::Expand
- Sales::Renew
- Sales::Upsell
- Sales::CrossSell
- Sales::Intervene_Churn
- Sales::Revive_Deal
- Sales::Backchannel
- Sales::Initiate_Warm_Intro
- Sales::Mutual_Action_Plan
- Sales::Lock_Competitor_Out
- Sales::Validate_Champion
- Sales::Route_Assign_Lead
- Sales::Escalate

📣 Marketing
- Marketing::Launch_Campaign
- Marketing::Retarget
- Marketing::Score_Lead
- Marketing::Nurture
- Marketing::Segment
- Marketing::Localize
- Marketing::AB_Test
- Marketing::Syndicate_Content
- Marketing::Activate_MQL
- Marketing::Recycle_Lead
- Marketing::Run_Webinar
- Marketing::Gated_Content_Sequence
- Marketing::Amplify_Social
- Marketing::Run_Field_Event
- Marketing::Coordinate_Channel

🌟 CustomerSuccess
- CustomerSuccess::Onboard
- CustomerSuccess::Health_Check
- CustomerSuccess::QBR
- CustomerSuccess::Send_Survey
- CustomerSuccess::Launch_Advocacy_Program
- CustomerSuccess::Request_Case_Study
- CustomerSuccess::Prevent_Churn
- CustomerSuccess::Rescue_AtRisk
- CustomerSuccess::Escalate_Ticket
- CustomerSuccess::Assign_CSM
- CustomerSuccess::Handoff
- CustomerSuccess::Reference_Call
- CustomerSuccess::Coach_Train
- CustomerSuccess::Adoption_Push
- CustomerSuccess::Trigger_Upsell_Renewal

🤝 Partner
- Partner::CoSell
- Partner::Assign_Partner_Lead
- Partner::Track_Sourced_Deal
- Partner::MDF_Request
- Partner::Conflict_Resolution
- Partner::Enable
- Partner::Reward_Referral
- Partner::Upgrade_Tier
- Partner::Downgrade_Tier
- Partner::Coordinate_CoMarketing
- Partner::Run_Partner_Training
- Partner::Partner_QBR
- Partner::Distributor_Onboarding

🧩 RevOps
- RevOps::Enrich_Data
- RevOps::Audit_Pipeline
- RevOps::Backfill_Records
- RevOps::Deduplicate
- RevOps::Assign_Owner
- RevOps::Trigger_Data_Alert
- RevOps::CRM_Sync
- RevOps::Integrate
- RevOps::Log_Tag_Signal
- RevOps::Route_To_Team
- RevOps::Analyze_Forecast
- RevOps::Assign_Playbook
- RevOps::AI_Review
- RevOps::Score_Signal
- RevOps::Record_Feedback
- RevOps::Generate_Report

🛠️ Product
- Product::Alert_Bug
- Product::Flag_Feature_Request
- Product::Invite_Beta
- Product::Rollout_Feature
- Product::Deprecate_Feature
- Product::Monitor_Adoption
- Product::Schedule_Workshop
- Product::Trigger_Product_Survey

🔄 Shared
- Shared::Align
- Shared::Collaborate
- Shared::Handoff
- Shared::Escalate
- Shared::Normalize
- Shared::Simulate
- Shared::Replace
- Shared::Recommend
- Shared::Educate
- Shared::Cluster
- Shared::Adapt
- Shared::Trigger_Sequence
- Shared::Reinforce
- Shared::Intervene
- Shared::Experiment
- Shared::Pause
- Shared::Resume
- Shared::Personalize
- Shared::Coach
- Shared::Notify
- Shared::Record

🔍 New V4 Verbs (Constellation + Governance)
- Shared::Diagnose_Governance_Model
- Shared::Reflect_System_Violation
- Shared::Reframe_Role_Drift
- Shared::Reveal_Concealed_Tension
- Shared::Clarify_Decision_Actor
- Shared::Anchor_Intent
- Shared::Restore_Buying_Momentum
- Shared::Label_Missing_Sponsorship
- Shared::Ground_Through_Reference
- Shared::Escalate_Systemic_Block
- Shared::De-risk_By_Proxy

# =========================
# AURA ONTOLOGY V4.1: NEW ACTION VERBS
# =========================

verbs:
 # Proactive Intelligence
 - Intelligence::Predict_Deal_Outcome
 - Intelligence::Anticipate_Objection_Emergence
 - Intelligence::Forecast_Stakeholder_Changes
 - Intelligence::Model_Competitive_Threat_Evolution
 - Intelligence::Simulate_Negotiation_Scenarios
 - Intelligence::Project_Implementation_Risk

 # Relationship Orchestration
 - Relationship::Strengthen_Champion_Network
 - Relationship::Neutralize_Blocker_Resistance
 - Relationship::Expand_Stakeholder_Access
 - Relationship::Facilitate_Internal_Consensus
 - Relationship::Bridge_Communication_Gaps
 - Relationship::Orchestrate_Executive_Alignment

 # Competitive Maneuvering
 - Competitive::Differentiate_From_Competitors
 - Competitive::Neutralize_Competitive_Threats
 - Competitive::Leverage_Competitive_Weaknesses
 - Competitive::Reframe_Competitive_Narrative
 - Competitive::Accelerate_Versus_Competition
 - Competitive::Lockout_Competitive_Access

 # Value Amplification
 - Value::Quantify_Business_Impact
 - Value::Demonstrate_ROI_Realization
 - Value::Showcase_Success_Stories
 - Value::Calculate_Opportunity_Costs
 - Value::Model_Implementation_Benefits
 - Value::Validate_Value_Assumptions

 # Risk Mitigation
 - Risk::De-risk_Implementation
 - Risk::Address_Compliance_Concerns
 - Risk::Mitigate_Technical_Risks
 - Risk::Resolve_Procurement_Barriers
 - Risk::Navigate_Organizational_Changes
 - Risk::Manage_Timeline_Pressures`;
