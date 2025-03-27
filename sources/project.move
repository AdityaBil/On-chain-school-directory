module MyModule::Voting {
    use std::signer;
    use std::vector;
    use aptos_framework::account;

    /// Struct representing a voting proposal
    struct Proposal has store, key {
        id: u64,
        description: vector<u8>,
        votes_for: u64,
        votes_against: u64,
        voters: vector<address>
    }

    /// Function to create a new voting proposal
    public fun create_proposal(
        creator: &signer, 
        description: vector<u8>
    ) {
        let proposal = Proposal {
            id: account::get_sequence_number(signer::address_of(creator)),
            description,
            votes_for: 0,
            votes_against: 0,
            voters: vector::empty()
        };
        move_to(creator, proposal);
    }

    /// Function to vote on an existing proposal
    public fun vote_on_proposal(
        voter: &signer, 
        proposal_creator: address, 
        vote_in_favor: bool
    ) acquires Proposal {
        let proposal = borrow_global_mut<Proposal>(proposal_creator);
        
        // Check if voter has already voted
        assert!(
            !vector::contains(&proposal.voters, &signer::address_of(voter)), 
            1
        );

        // Record the vote
        if (vote_in_favor) {
            proposal.votes_for = proposal.votes_for + 1;
        } else {
            proposal.votes_against = proposal.votes_against + 1;
        };

        // Add voter to prevent multiple votes
        vector::push_back(&mut proposal.voters, signer::address_of(voter));
    }
}