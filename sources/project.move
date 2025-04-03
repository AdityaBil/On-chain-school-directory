module MyModule::VotingSystem {
    use aptos_framework::signer;
    use std::string::String;
    use std::vector;

    struct Proposal has key, store {
        name: String,
        voters: vector<address>, // Ensure it's a vector type
    }

    /// Function to create a new proposal
    public fun create_proposal(owner: &signer, name: String) {
        let proposal = Proposal {
            name,
            voters: vector::empty<address>(), // Initialize as an empty vector
        };
        move_to(owner, proposal);
    }

    /// Function to vote on a proposal
    public fun vote(voter: &signer, proposal_owner: address) acquires Proposal {
        let proposal = borrow_global_mut<Proposal>(proposal_owner);

        // Add voter's address to the list of voters
        vector::push_back(&mut proposal.voters, signer::address_of(voter));
    }
}
