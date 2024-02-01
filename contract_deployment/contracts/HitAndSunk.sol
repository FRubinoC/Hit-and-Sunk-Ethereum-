// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/* ************************* HIT AND SUNK CONTRACT *************************** */

contract HitAndSunk
{
    using SafeMath for uint8;
    using SafeMath for uint256;

    uint constant num_games = 10;
    uint constant num_cells = 64;
    uint constant dim_row = 8;
    
    /* **************** POSSIBLE STATE VALUE ****************** */
    uint constant available = 0;
    uint constant player1_turn = 7;
    uint constant player2_turn = 1;
    
    uint constant verification_player1_win= 2;
    uint constant verification_player2_win = 3;
    
    uint constant match_over = 4;
    uint constant wait_player1_outcome = 5;
    uint constant wait_player2_outcome = 6;
    
    
    uint constant wait_for_player = 8;
    uint constant wait_for_friend = 9;
    
    uint constant decide_reward = 10;
    
    uint constant wait_both_transactions = 11;
    uint constant wait_player1_transaction = 12;
    uint constant wait_player2_transaction = 13;
    
    uint constant wait_both_dispositions = 14;
    uint constant wait_player1_disposition = 15;
    uint constant wait_player2_disposition = 16;
    
    uint constant match_payed = 17;
    
    /* ****************** POSSIBLE CELL VALUE ****************** */
    
    uint8 constant not_asked = 0;
    uint8 constant water = 1;
    uint8 constant hit = 2;
    uint8 constant sunk = 3;
    uint8 constant asked = 4;
    uint8 constant ship = 6;
    
    // Marked cells during the verification process
    uint8 constant proven_asked = 5;
    uint8 constant proven_not_asked = 6; 

    uint8 constant proven_marked = 7;
    
    /* ****************** DIRECTION TRANSLATION ****************** */
    
    uint16 constant N = 0;
    uint16 constant S = 1;
    uint16 constant W = 2;
    uint16 constant E = 3;

    /* **************** MAX INACTIVITY TIME CONSTANT ***************** */
    uint constant inactivity_time_limit = 2; //In blocks
    


    address [num_games] public player1;
    address [num_games] public player2;
    address payable [num_games] public winner;

    bytes32[num_games] public merkle_root1;
    bytes32[num_games] public merkle_root2;

    uint16[2*num_cells*num_games] public game_matrix;

    /**************** SCORE VARIABLE ******************/
    // Here we save whether or not the player has sunk the ships of different dimension

    bool[2*num_games] public sunk_1;
    bool[2*num_games] public sunk_2;
    bool[2*num_games] public sunk_3;
    bool[2*num_games] public sunk_4;
    bool[2*num_games] public sunk_5;


    uint[num_games*2] public reward;
    uint[num_games] public state;
    uint[num_games] public last_inactivity_request;
    uint public balance = 0;
 

    event newGameInfo(uint game_ID, uint state_ID, address player);
    event changeReward(uint player, uint new_reward, uint gaID);
    event amountToPay(uint amount, uint gaID);
    event changeState(uint new_state, uint gaID);
    event matchWinner(uint winner_player, uint gaID);
    event hitTried(uint player, uint cell, uint gaID);
    event gotWater(uint player, uint cell, uint gaID);
    event hitShip(uint player, uint cell, uint gaID);
    event sunkShip(uint player, uint cell, uint direction, uint dimension, uint gaID);
    event cellVerified(uint player, uint cell, uint gaID);
    event sunkVerified(uint player, uint number_sunk, uint gaID);
    event abandonment_request(uint gaID, uint player);


    function new_game() public returns (uint game_ID, uint state_ID)
    {
        uint i;

        for (i = 0; i < num_games; i++)
        {
            if (state[i] == available)
            {
                player1[i] = msg.sender;
                state[i] = wait_for_player;
                emit newGameInfo(i, state[i], msg.sender);
                return (i, state[i]);
            }
            else if (state[i] == wait_for_player && player1[i] != msg.sender)
            {
                player2[i] = msg.sender;
                state[i] = decide_reward;
                emit newGameInfo(i, state[i], msg.sender);
                return (i, state[i]);
            }
        }
        return (num_games, 0);
    }


    function new_game_with_friend() public returns (uint game_ID)
    {
        uint i;
        
        for (i = 0; i < num_games; i++)
        {
            if (state[i] == available)
            {
                player1[i] = msg.sender;
                state[i] = wait_for_friend;
                emit newGameInfo(i, state[i], msg.sender);
                return i;
            }
        }
        return num_games;
    }


    function join_friend(uint game_ID) public returns (bool result)
    {
        require (game_ID < num_games);
        require (state[game_ID] == wait_for_friend);
        player2[game_ID] = msg.sender;
        state[game_ID] = decide_reward;
        emit newGameInfo(game_ID, state[game_ID], msg.sender);
        return true;
    }


    function set_reward(uint reward_value, uint player, uint game_ID) public returns (bool result)
    {
        require ((player == 1 || player == 2) && game_ID < num_games && reward_value != 0 && state[game_ID] == decide_reward);
        
        if (player == 1)
        {
            if (msg.sender == player1[game_ID])
            {
                reward[game_ID*2] = reward_value;
                if (reward[game_ID*2] == reward[game_ID*2 + 1])
                {
                    state[game_ID] = wait_both_transactions;
                    last_inactivity_request[game_ID] = 0;
                    emit amountToPay(reward_value, game_ID);
                }
                else emit changeReward(1, reward_value, game_ID);
                return true;
            }
        }
        else if (player == 2)
        {
            if (msg.sender == player2[game_ID])
            {
                reward[game_ID*2+1] = reward_value;
                if (reward[game_ID*2] == reward[game_ID*2 + 1])
                {
                    state[game_ID] = wait_both_transactions;
                    last_inactivity_request[game_ID] = 0;
                    emit amountToPay(reward_value, game_ID);
                }
                else emit changeReward(2, reward_value, game_ID);
                return true;
            }
        }
        return false;   
    } 


    function send_transaction(uint player, uint game_ID) public payable returns (bool result)
    {
        require (game_ID < num_games);
        require (player == 1 || player == 2);
        require (msg.value == reward[game_ID]*1e18);

        if (player == 1)
        {
            if (state[game_ID] == wait_both_transactions) state[game_ID] = wait_player2_transaction;
            else if (state[game_ID] == wait_player1_transaction) state[game_ID] = wait_both_dispositions; //go to decide the disposition
            last_inactivity_request[game_ID] = 0;

            emit changeState(state[game_ID], game_ID);
        }

        if (player == 2)
        {
            if (state[game_ID] == wait_both_transactions) state[game_ID] = wait_player1_transaction; //wait for player1 to pay
            else if (state[game_ID] == wait_player2_transaction) state[game_ID] = wait_both_dispositions; //go to decide the disposition
            last_inactivity_request[game_ID] = 0;

            emit changeState(state[game_ID], game_ID);
        }
        balance += msg.value;
        return true;
    }


    function commit_disposition(uint player, uint game_ID, bytes32 merkle_root) public returns (bool result)
    {
        require (game_ID < num_games);
        require ((player == 1 && (state[game_ID] == wait_both_dispositions || state[game_ID] == wait_player1_disposition) && msg.sender == player1[game_ID]) ||
                 (player == 2 && (state[game_ID] == wait_both_dispositions || state[game_ID] == wait_player2_disposition) && msg.sender == player2[game_ID])); //state should be wait_both_disposition, wait_player1 or wait_player2
        
        if (player == 1)
        {
            if (state[game_ID] == wait_both_dispositions) state[game_ID] = wait_player2_disposition;
            else if (state[game_ID] == wait_player1_disposition) state[game_ID] = player1_turn;
            last_inactivity_request[game_ID] = 0;

            merkle_root1[game_ID] = merkle_root; 
            emit changeState(state[game_ID], game_ID);
        }

        if (player == 2)
        {
            if (state[game_ID] == wait_both_dispositions) state[game_ID] = wait_player1_disposition;
            else if (state[game_ID] == wait_player2_disposition) state[game_ID] = player1_turn;
            last_inactivity_request[game_ID] = 0;

            merkle_root2[game_ID] = merkle_root;
            emit changeState(state[game_ID], game_ID);
        }
        return true;
    }

    function try_hit(uint player, uint cell, uint game_ID) public returns (bool result)
    {
        require (game_ID < num_games);
        require (cell < num_cells);
        require (player == 1 || player == 2);

        uint ground_player = 0;
        if (player == 1) ground_player = 2;
        else             ground_player = 1;
        require (game_matrix[2*num_cells*game_ID + num_cells*(ground_player-1) + cell] == not_asked);
        require ((msg.sender == player1[game_ID] && state[game_ID] == player1_turn)||
                 (msg.sender == player2[game_ID] && state[game_ID] == player2_turn));        
        
        game_matrix[2*num_cells*game_ID + num_cells*(ground_player-1) + cell] = asked;
        if (player == 1) state[game_ID] = wait_player2_outcome;
        else state[game_ID] = wait_player1_outcome;
        last_inactivity_request[game_ID] = 0;

        emit hitTried(player, cell, game_ID);
        return true;
    }


    function outcome_water(bytes32[] calldata proof, uint8 seed, uint player, uint cell, uint game_ID) public returns (bool result)
    {
        require (game_ID < num_games);
        require (cell < num_cells);
        require ((player == 1 && msg.sender == player1[game_ID] && state[game_ID] == wait_player1_outcome) ||
                 (player == 2 && msg.sender == player2[game_ID] && state[game_ID] == wait_player2_outcome));
        require (game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell] == asked);
        /*
            Part to verify the proof
        */
        bytes32 merkleLeaf = keccak256(abi.encodePacked(water.add(seed)));
        if (player == 1) require (MerkleProof.verify(proof, merkle_root1[game_ID], merkleLeaf));
        else             require (MerkleProof.verify(proof, merkle_root2[game_ID], merkleLeaf));

        game_matrix[2*game_ID*num_cells + (player-1)*num_cells + cell] = water;
        if (player == 2) state[game_ID] = player2_turn;
        else if (player == 1) state[game_ID] = player1_turn;
        last_inactivity_request[game_ID] = 0;

        emit gotWater(player, cell, game_ID);
        return true;
    }


    function outcome_hit(bytes32[] calldata proof, uint8 seed, uint player, uint cell, uint game_ID) public returns (bool result)
    {
        require (game_ID < num_games);
        require (cell < num_cells);
        require ((player == 1 && state[game_ID] == wait_player1_outcome && player1[game_ID] == msg.sender) ||
                 (player == 2 && state[game_ID] == wait_player2_outcome && player2[game_ID] == msg.sender));
        require (game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell] == asked);
        
        /*
            Part to verify the proof
        */
        bytes32 merkleLeaf = keccak256(abi.encodePacked(ship.add(seed)));
        if (player == 1) require (MerkleProof.verify(proof, merkle_root1[game_ID], merkleLeaf));
        else             require (MerkleProof.verify(proof, merkle_root2[game_ID], merkleLeaf));

        game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell] = hit;
        if (player == 1)
        {
            state[game_ID] = player1_turn;
            emit hitShip(2, cell, game_ID);
        }
        else
        {
            state[game_ID] = player2_turn;
            emit hitShip(1, cell, game_ID);
        }
        last_inactivity_request[game_ID] = 0;
        return true;
    }


    function outcome_sunk(bytes32[] calldata proof, uint8 seed, uint player, uint cell, uint dimension, uint direction, uint game_ID) public returns(bool result)
    {
        require (game_ID < num_games);
        require (cell < num_cells);
        require (dimension <= 5 && dimension != 0);
        require (direction == E || direction == S);

        if (direction == S) require (cell + (dimension-1)*dim_row < num_cells);
        else
        {
            uint divisor1 = 0;
            uint divisor2 = 0;
            while (divisor1*dim_row <= cell)             divisor1++;
            while (divisor2*dim_row <= cell+dimension-1) divisor2++;
            require (divisor1 == divisor2);
        }

        require ((player == 1 && msg.sender == player1[game_ID] && state[game_ID] == wait_player1_outcome) ||
                 (player == 2 && msg.sender == player2[game_ID] && state[game_ID] == wait_player2_outcome));

        if (dimension == 1) require (sunk_1[game_ID*2 + player-1] == false);
        if (dimension == 2) require (sunk_2[game_ID*2 + player-1] == false);
        if (dimension == 3) require (sunk_3[game_ID*2 + player-1] == false);
        if (dimension == 4) require (sunk_4[game_ID*2 + player-1] == false);
        if (dimension == 5) require (sunk_5[game_ID*2 + player-1] == false);

        //VERIFY THE MERKLE PROOF
        bytes32 merkleLeaf =  keccak256(abi.encodePacked(ship.add(seed)));
        if (player == 1) require (MerkleProof.verify(proof, merkle_root1[game_ID], merkleLeaf));
        else             require (MerkleProof.verify(proof, merkle_root2[game_ID], merkleLeaf));
        
        
        uint i = 0;
        uint num_asked = 0;
        uint num_hit = 0;
        if (direction == E)
        {
            for (i = 0; i < dimension; i++)
            {
                if      (game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell+i] == asked) num_asked++;
                else if (game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell+i] == hit) num_hit++;
            }
        }
        else if (direction == S)
        {
            for (i = 0; i < dimension; i++)
            {
                if      (game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell + i*dim_row] == asked) num_asked++;
                else if (game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell + i*dim_row] == hit) num_hit++;
            }
        }
        //require (num_asked == 1 && num_hit + num_asked == dimension);

        if (direction == E)
        {
            for (i = 0; i < dimension; i++)
            {
                game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell + i] = sunk;
            }
        }
        else if (direction == S)
        {
            for (i = 0; i < dimension; i++)
            {
                game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell + i*dim_row] = sunk;
            }
        }
    
        if      (dimension == 1) sunk_1[game_ID*2 + player-1] = true;
        else if (dimension == 2) sunk_2[game_ID*2 + player-1] = true;
        else if (dimension == 3) sunk_3[game_ID*2 + player-1] = true;
        else if (dimension == 4) sunk_4[game_ID*2 + player-1] = true;
        else if (dimension == 5) sunk_5[game_ID*2 + player-1] = true;
        else return false;
        
        if (sunk_1[game_ID*2 + player-1] == true &&
            sunk_2[game_ID*2 + player-1] == true &&
            sunk_3[game_ID*2 + player-1] == true &&
            sunk_4[game_ID*2 + player-1] == true &&
            sunk_5[game_ID*2 + player-1] == true)
        {
            if (player == 1) state[game_ID] = verification_player2_win;
            else             state[game_ID] = verification_player1_win;
            last_inactivity_request[game_ID] = 0;
            
            emit changeState(state[game_ID], game_ID);
            return true;
        }
        else
        {
            if (player == 1) state[game_ID] = player1_turn;
            else             state[game_ID] = player2_turn;
            last_inactivity_request[game_ID] = 0;

            emit sunkShip(player, cell, direction, dimension, game_ID);
            return true;
        }
    }

    function adversary_quit(uint game_ID, uint player) public returns (uint result)
    {
        require (game_ID < num_games);
        if (player == 1) 
        {
            require (msg.sender == player1[game_ID]);
            require (state[game_ID] == player2_turn || state[game_ID] == wait_player2_disposition || 
                     state[game_ID] == wait_player2_transaction || state[game_ID] == wait_player2_outcome ||
                     state[game_ID] == verification_player2_win);

            if (last_inactivity_request[game_ID] == 0)
            {
                last_inactivity_request[game_ID] = block.number;
                emit abandonment_request(game_ID, player);
                return block.number;
            }
            else
            {
                if (block.number >= last_inactivity_request[game_ID] + inactivity_time_limit)
                {
                    if (state[game_ID] == wait_player2_transaction) reward[game_ID+1] = 0;
                    state[game_ID] = match_over;
                    last_inactivity_request[game_ID] = 0;

                    winner[game_ID] = payable(msg.sender);
                    emit matchWinner(1, game_ID);
                }
                return block.number;
            }
        }
        else if (player == 2) 
        {
            require (msg.sender == player2[game_ID]);
            require (state[game_ID] == player1_turn || state[game_ID] == wait_player1_disposition || 
                     state[game_ID] == wait_player1_transaction || state[game_ID] == wait_player1_outcome ||
                     state[game_ID] == verification_player1_win);
            
            if (last_inactivity_request[game_ID] == 0)
            {
                last_inactivity_request[game_ID] = block.number;
                emit abandonment_request(game_ID, player);
                return block.number;
            }
            else
            {
                if (block.number >= last_inactivity_request[game_ID] + inactivity_time_limit)
                {
                    if (state[game_ID] == wait_player1_transaction) reward[game_ID] = 0;
                    state[game_ID] = match_over;
                    last_inactivity_request[game_ID] = 0;

                    winner[game_ID] = payable(msg.sender);
                    emit matchWinner(2, game_ID);
                }
                return block.number;
            }
        }
        else return 0;
    }


    function verify_cell(bytes32[] calldata proof, uint8 seed, uint player, uint cell, uint game_ID) public returns(bool result)
    {
        require (game_ID < num_games);
        require (cell < num_cells);
        require ((player == 1 && state[game_ID] == verification_player1_win && msg.sender == player1[game_ID]) ||
                 (player == 2 && state[game_ID] == verification_player2_win && msg.sender == player2[game_ID]));

        require (game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell] == hit ||
                 game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell] == not_asked);
        /*
            VERIFY THE CORRECTNESS OF THE CELL
        */
        bytes32 merkleLeaf = keccak256(abi.encodePacked(ship.add(seed)));
        if (player == 1) require (MerkleProof.verify(proof, merkle_root1[game_ID], merkleLeaf));
        else             require (MerkleProof.verify(proof, merkle_root2[game_ID], merkleLeaf));
        
        if  (game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell] == not_asked) game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell] = proven_not_asked;
        else game_matrix[2*game_ID*num_cells + num_cells*(player-1) + cell] = proven_asked;
        emit cellVerified(player, cell, game_ID);
        return true;
    }


    function verify_sunk(uint player, uint starting_cell, uint16 direction, uint16 dimension, uint game_ID) public returns(bool result)
    {
        require (game_ID < num_games);
        require (direction == S || direction == E);
        require (dimension <= 5 && dimension != 0);
        require (state[game_ID] == verification_player1_win && msg.sender == player1[game_ID] ||
                 state[game_ID] == verification_player2_win && msg.sender == player2[game_ID]);
        
        if (dimension == 1) require (sunk_1[game_ID*2 + player-1] == false);
        if (dimension == 2) require (sunk_2[game_ID*2 + player-1] == false);
        if (dimension == 3) require (sunk_3[game_ID*2 + player-1] == false);
        if (dimension == 4) require (sunk_4[game_ID*2 + player-1] == false);
        if (dimension == 5) require (sunk_5[game_ID*2 + player-1] == false);
        
        if (direction == S)
        {
            uint num_not_asked = 0;
            require (starting_cell + (dimension-1)*dim_row < num_cells);
            for (uint i = 0; i < dimension; i++)
            {
                require (game_matrix[2*game_ID*num_cells + num_cells*(player-1) + starting_cell + dim_row*i] == proven_asked || 
                         game_matrix[2*game_ID*num_cells + num_cells*(player-1) + starting_cell + dim_row*i] == proven_not_asked);
                if (game_matrix[2*game_ID*num_cells + num_cells*(player-1) + starting_cell + dim_row*i] == proven_not_asked) num_not_asked++;
            }
            require (num_not_asked > 0);
            for (uint i = 0; i < dimension; i++)
            {
                game_matrix[2*game_ID*num_cells + num_cells*(player-1) + starting_cell + dim_row*i] = proven_marked;
            }
        }
        if (direction == E)
        {
            require (starting_cell + dimension-1 < num_cells);
            
            uint num_not_asked = 0;
            uint divisor1 = 0;
            uint divisor2 = 0;
            while (divisor1*dim_row <= starting_cell)             divisor1++;
            while (divisor2*dim_row <= starting_cell+dimension-1) divisor2++;
            require (divisor1 == divisor2);

            for (uint i = 0; i < dimension; i++)
            {
                require (game_matrix[2*game_ID*num_cells + num_cells*(player-1) + starting_cell + i] == proven_asked || 
                         game_matrix[2*game_ID*num_cells + num_cells*(player-1) + starting_cell + i] == proven_not_asked);
                if (game_matrix[2*game_ID*num_cells + num_cells*(player-1) + starting_cell + i] == proven_not_asked) num_not_asked++;
            }
            require (num_not_asked > 0);
            for (uint i = 0; i < dimension; i++)
            {
                game_matrix[2*game_ID*num_cells + num_cells*(player-1) + starting_cell + i] = proven_marked;
            }
        }
        //CHECK THE SUNK
        if      (dimension == 1) sunk_1[game_ID*2 + player-1] = true;
        else if (dimension == 2) sunk_2[game_ID*2 + player-1] = true;
        else if (dimension == 3) sunk_3[game_ID*2 + player-1] = true;
        else if (dimension == 4) sunk_4[game_ID*2 + player-1] = true;
        else if (dimension == 5) sunk_5[game_ID*2 + player-1] = true;
        
        if (sunk_1[game_ID*2 + player-1] && sunk_2[game_ID*2 + player-1] && sunk_3[game_ID*2 + player-1] && sunk_4[game_ID*2 + player-1] && sunk_5[game_ID*2 + player-1])
        {
            winner[game_ID] = payable(msg.sender);
            state[game_ID] = match_over;
            last_inactivity_request[game_ID] = 0;

            emit matchWinner(player, game_ID);
            return true;
        }
        else emit sunkVerified(player, dimension, game_ID);
        return true;
    }

    function updateState(uint new_state, uint game_ID) private
    {
        require (game_ID < 0 || game_ID >= num_games);
        state[game_ID] = new_state;
        last_inactivity_request[game_ID] = 0;
    }

    function withdraw_reward(uint game_ID, uint amount) public returns (bool result)
    {
        require (state[game_ID] == match_over && payable(msg.sender) == winner[game_ID]);
        require (amount == reward[game_ID]+reward[game_ID+1]);
        require (balance >= amount);

        balance -= amount*1e18;
        winner[game_ID].transfer(amount*1e18);
        state[game_ID] = match_payed;
        return true;
    } 
}