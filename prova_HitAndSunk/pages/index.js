import Head from 'next/head'
import Image from 'next/image'
import bulma from 'bulma/css/bulma.css'
import styles from '../styles/Home.module.css'
import Web3 from 'web3';
import { useState, useEffect } from 'react'
import { MerkleTree } from 'merkletreejs'
import HitAndSunkContract from '../contract_deployment/util.js'



export default function Hit_and_sunk()
{
    //const { MerkleTree } = require('merkletreejs')
    const num_games = 10;
    const num_cells = 64;
    const dim_row = 8;

    /* **************** POSSIBLE STATE VALUE ****************** */

    const available = 0;
    const player1_turn = 7;
    const player2_turn = 1;
    const verification_player1_win= 2;
    const verification_player2_win = 3;

    const finished = 4;
    const wait_player1_outcome = 5;
    const wait_player2_outcome = 6;

    const wait_for_player = 8;
    const wait_for_friend = 9;

    const decide_reward = 10;

    const wait_both_transactions = 11;
    const wait_player1_transaction = 12;
    const wait_player2_transaction = 13;

    const wait_both_dispositions = 14;
    const wait_player1_disposition = 15;
    const wait_player2_disposition = 16;

    const match_over = 17;
    const no_state = 18;

    /* ********************************************************** */


    /* ****************** POSSIBLE ADVERSARY CELL VALUE ****************** */

    const not_asked = 0;
    const water = 1;
    const hit = 2;
    const sunk = 3;
    const asked = 4;
    const ship = 6;


    // Marked cells during the verification process
    const proven_asked = 5;
    const proven_not_asked = 6; /*This is used to mark a cell that is proven 
                                  to be of a ship but is not been asked during the game.
                                  It's important because, to verify that the player has not
                                  cheated, at least one cell should be not asked before */
    const proven_marked = 7;    /*We mark the ship to avoid cheating consisting of locating
                                  ships on the same cell */

    /* ********************************************************* */


    
    /* ****************** DIRECTION TRANSLATION ****************** */

    const N = 0;
    const S = 1;
    const W = 2;
    const E = 3;

    // Vertical and Horizontal
    const V = 1;
    const H = 3;

    /* ************************************************************* */

    const safe = 5;
    const letter_set = ["A","B","C","D","E","F","G","H","a","b","c","d","e","f","g","h"];
    const number_set = ["1","2","3","4","5","6","7","8"];

    
    // STATE VARIABLE

    const [web3_obj, setWeb3] = useState(null);
    const [my_address, setMyAddress] = useState();
    const [HContract, setContract] = useState(null);

    var GaID = null;
    var state = no_state;
    var player = 0;
    var reward = 0;
    var num_verified = 0;
    var my_ship_1 = [0, N, safe];
    var my_ship_2 = [0, N, safe];
    var my_ship_3 = [0, N, safe];
    var my_ship_4 = [0, N, safe];
    var my_ship_5 = [0, N, safe];
    var opponent_ship_1 = [0, N, safe];
    var opponent_ship_2 = [0, N, safe];
    var opponent_ship_3 = [0, N, safe];
    var opponent_ship_4 = [0, N, safe];
    var opponent_ship_5 = [0, N, safe];
    var my_playground = new Array(num_cells).fill(water);
    var opponent_playground = new Array(num_cells).fill(not_asked);
    var last_event_num = 0;

    var seeds = [];
    var seededGround = [];
    var hashedGround = [];
    var myMerkleTree;
    var myMerkleRoot;



    const init = async () =>
    {
        console.log("Starting the init function");
        
        var owner_playground_grid = document.getElementById('owner-playground');
        var adversary_playground_grid = document.getElementById('adversary-playground');
        var row_letter = "A";
        var column_int = 1;

        //SETTING OF THE TITLE
        var title = document.getElementById("my-playground-text");
        title.textContent = "My Playground";

        var title = document.getElementById("ad-playground-text");
        title.textContent = "Adversary Playground";


        // SETTING OF THE PLAYER PLAYGROUND
        var cell = document.createElement("div");
        owner_playground_grid.appendChild(cell);

        for (var i = 0; i < dim_row; i++)
        {
            cell = document.createElement("div");
            var content = document.createElement("h1");
            content.textContent = row_letter;
            row_letter = String.fromCharCode(row_letter.charCodeAt(0) + 1);

            cell.appendChild(content);
            owner_playground_grid.appendChild(cell);
        }
        for (var i = 0; i < dim_row; i++)
        {

            cell = document.createElement("div");
            var content = document.createElement("h1");
            content.textContent = column_int.toString();
            column_int++;
            cell.appendChild(content);
            owner_playground_grid.appendChild(cell);
            for (var j = 0; j < dim_row; j++)
            {
                cell = document.createElement("div");
                cell.setAttribute("id", "my-cell-"+(i*dim_row+j).toString());
                cell.setAttribute("class", styles.cells);
                owner_playground_grid.appendChild(cell);
            }
        }

        //SETTING OF THE ADVERSARY PLAYGROUND
        row_letter = "A";
        column_int = 1;

        cell = document.createElement("div");
        adversary_playground_grid.appendChild(cell);
        for (var i = 0; i < dim_row; i++)
        {
            cell = document.createElement("div");
            var content = document.createElement("h1");
            content.textContent = row_letter;
            row_letter = String.fromCharCode(row_letter.charCodeAt(0) + 1);

            cell.appendChild(content);
            adversary_playground_grid.appendChild(cell);
        }
        for (var i = 0; i < dim_row; i++)
        {

            cell = document.createElement("div");
            var content = document.createElement("h1");
            content.textContent = column_int.toString();
            column_int++;
            cell.appendChild(content);
            adversary_playground_grid.appendChild(cell);
            for (var j = 0; j < dim_row; j++)
            {
                cell = document.createElement("div");
                cell.setAttribute("id", "adversary-cell-"+(i*dim_row+j).toString());
                cell.setAttribute("class", "adversary-cell-empty");
                var cell_btn = document.createElement("div");
                cell_btn.setAttribute("id", "adversary-cellbutton-"+(i*dim_row+j).toString());
                cell_btn.setAttribute("class", styles.adversarycell_btn);
                cell_btn.disabled = true;
                cell.appendChild(cell_btn);
                adversary_playground_grid.appendChild(cell);
            }
        }

        //SETTING PLAYGROUND SEEDS
        for (let i = 0; i < 64; i++) 
        {
            const seed = Math.floor(Math.random() * 255); // random numbers from 0 to 254
            seeds.push(seed);
        }

        //Setting of the buttons function
        setTryHit();
    }

    const setTryHit = async () =>
    {
        var cell_btn = document.getElementById("adversary-cellbutton-0");
        cell_btn.onclick = function(){tryHit(0)};
        
        cell_btn = document.getElementById("adversary-cellbutton-1");
        cell_btn.onclick = function(){tryHit(1)};

        cell_btn = document.getElementById("adversary-cellbutton-2");
        cell_btn.onclick = function(){tryHit(2)};

        cell_btn = document.getElementById("adversary-cellbutton-3");
        cell_btn.onclick = function(){tryHit(3)};

        cell_btn = document.getElementById("adversary-cellbutton-4");
        cell_btn.onclick = function(){tryHit(4)};

        cell_btn = document.getElementById("adversary-cellbutton-5");
        cell_btn.onclick = function(){tryHit(5)};

        cell_btn = document.getElementById("adversary-cellbutton-6");
        cell_btn.onclick = function(){tryHit(6)};

        cell_btn = document.getElementById("adversary-cellbutton-7");
        cell_btn.onclick = function(){tryHit(7)};

        cell_btn = document.getElementById("adversary-cellbutton-8");
        cell_btn.onclick = function(){tryHit(8)};

        cell_btn = document.getElementById("adversary-cellbutton-9");
        cell_btn.onclick = function(){tryHit(9)};

        cell_btn = document.getElementById("adversary-cellbutton-10");
        cell_btn.onclick = function(){tryHit(10)};

        cell_btn = document.getElementById("adversary-cellbutton-11");
        cell_btn.onclick = function(){tryHit(11)};

        cell_btn = document.getElementById("adversary-cellbutton-12");
        cell_btn.onclick = function(){tryHit(12)};

        cell_btn = document.getElementById("adversary-cellbutton-13");
        cell_btn.onclick = function(){tryHit(13)};

        cell_btn = document.getElementById("adversary-cellbutton-14");
        cell_btn.onclick = function(){tryHit(14)};

        cell_btn = document.getElementById("adversary-cellbutton-15");
        cell_btn.onclick = function(){tryHit(15)};

        cell_btn = document.getElementById("adversary-cellbutton-16");
        cell_btn.onclick = function(){tryHit(16)};

        cell_btn = document.getElementById("adversary-cellbutton-17");
        cell_btn.onclick = function(){tryHit(17)};

        cell_btn = document.getElementById("adversary-cellbutton-18");
        cell_btn.onclick = function(){tryHit(18)};

        cell_btn = document.getElementById("adversary-cellbutton-19");
        cell_btn.onclick = function(){tryHit(19)};

        cell_btn = document.getElementById("adversary-cellbutton-20");
        cell_btn.onclick = function(){tryHit(20)};

        cell_btn = document.getElementById("adversary-cellbutton-21");
        cell_btn.onclick = function(){tryHit(21)};

        cell_btn = document.getElementById("adversary-cellbutton-22");
        cell_btn.onclick = function(){tryHit(22)};

        cell_btn = document.getElementById("adversary-cellbutton-23");
        cell_btn.onclick = function(){tryHit(23)};

        cell_btn = document.getElementById("adversary-cellbutton-24");
        cell_btn.onclick = function(){tryHit(24)};

        cell_btn = document.getElementById("adversary-cellbutton-25");
        cell_btn.onclick = function(){tryHit(25)};

        cell_btn = document.getElementById("adversary-cellbutton-26");
        cell_btn.onclick = function(){tryHit(26)};

        cell_btn = document.getElementById("adversary-cellbutton-27");
        cell_btn.onclick = function(){tryHit(27)};

        cell_btn = document.getElementById("adversary-cellbutton-28");
        cell_btn.onclick = function(){tryHit(28)};

        cell_btn = document.getElementById("adversary-cellbutton-29");
        cell_btn.onclick = function(){tryHit(29)};

        cell_btn = document.getElementById("adversary-cellbutton-30");
        cell_btn.onclick = function(){tryHit(30)};

        cell_btn = document.getElementById("adversary-cellbutton-31");
        cell_btn.onclick = function(){tryHit(31)};

        cell_btn = document.getElementById("adversary-cellbutton-32");
        cell_btn.onclick = function(){tryHit(32)};

        cell_btn = document.getElementById("adversary-cellbutton-33");
        cell_btn.onclick = function(){tryHit(33)};

        cell_btn = document.getElementById("adversary-cellbutton-34");
        cell_btn.onclick = function(){tryHit(34)};

        cell_btn = document.getElementById("adversary-cellbutton-35");
        cell_btn.onclick = function(){tryHit(35)};

        cell_btn = document.getElementById("adversary-cellbutton-36");
        cell_btn.onclick = function(){tryHit(36)};

        cell_btn = document.getElementById("adversary-cellbutton-37");
        cell_btn.onclick = function(){tryHit(37)};

        cell_btn = document.getElementById("adversary-cellbutton-38");
        cell_btn.onclick = function(){tryHit(38)};

        cell_btn = document.getElementById("adversary-cellbutton-39");
        cell_btn.onclick = function(){tryHit(39)};

        cell_btn = document.getElementById("adversary-cellbutton-40");
        cell_btn.onclick = function(){tryHit(40)};

        cell_btn = document.getElementById("adversary-cellbutton-41");
        cell_btn.onclick = function(){tryHit(41)};

        cell_btn = document.getElementById("adversary-cellbutton-42");
        cell_btn.onclick = function(){tryHit(42)};

        cell_btn = document.getElementById("adversary-cellbutton-43");
        cell_btn.onclick = function(){tryHit(43)};

        cell_btn = document.getElementById("adversary-cellbutton-44");
        cell_btn.onclick = function(){tryHit(44)};

        cell_btn = document.getElementById("adversary-cellbutton-45");
        cell_btn.onclick = function(){tryHit(45)};

        cell_btn = document.getElementById("adversary-cellbutton-46");
        cell_btn.onclick = function(){tryHit(46)};

        cell_btn = document.getElementById("adversary-cellbutton-47");
        cell_btn.onclick = function(){tryHit(47)};

        cell_btn = document.getElementById("adversary-cellbutton-48");
        cell_btn.onclick = function(){tryHit(48)};

        cell_btn = document.getElementById("adversary-cellbutton-49");
        cell_btn.onclick = function(){tryHit(49)};

        cell_btn = document.getElementById("adversary-cellbutton-50");
        cell_btn.onclick = function(){tryHit(50)};

        cell_btn = document.getElementById("adversary-cellbutton-51");
        cell_btn.onclick = function(){tryHit(51)};

        cell_btn = document.getElementById("adversary-cellbutton-52");
        cell_btn.onclick = function(){tryHit(52)};

        cell_btn = document.getElementById("adversary-cellbutton-53");
        cell_btn.onclick = function(){tryHit(53)};

        cell_btn = document.getElementById("adversary-cellbutton-54");
        cell_btn.onclick = function(){tryHit(54)};

        cell_btn = document.getElementById("adversary-cellbutton-55");
        cell_btn.onclick = function(){tryHit(55)};

        cell_btn = document.getElementById("adversary-cellbutton-56");
        cell_btn.onclick = function(){tryHit(56)};

        cell_btn = document.getElementById("adversary-cellbutton-57");
        cell_btn.onclick = function(){tryHit(57)};

        cell_btn = document.getElementById("adversary-cellbutton-58");
        cell_btn.onclick = function(){tryHit(58)};

        cell_btn = document.getElementById("adversary-cellbutton-59");
        cell_btn.onclick = function(){tryHit(59)};

        cell_btn = document.getElementById("adversary-cellbutton-60");
        cell_btn.onclick = function(){tryHit(60)};

        cell_btn = document.getElementById("adversary-cellbutton-61");
        cell_btn.onclick = function(){tryHit(61)};

        cell_btn = document.getElementById("adversary-cellbutton-62");
        cell_btn.onclick = function(){tryHit(62)};

        cell_btn = document.getElementById("adversary-cellbutton-63");
        cell_btn.onclick = function(){tryHit(63)};
    }
    

    const initWeb3 = async () =>
    {
        console.log("Starting the initWeb3 function");
        if (typeof window != "undefined" && typeof window.ethereum !== "undefined")
        {
            try
            {
                await window.ethereum.request({method: "eth_requestAccounts"});

                const web3 = new Web3(window.ethereum);
                setWeb3(web3);

                const accounts = await web3.eth.getAccounts()
                setMyAddress(accounts[0]);
            }
            catch(err)
            {
                console.log(err.message);
            }
        } 
        else alert("Metamask not installed");
        document.getElementById("Web3-button").disabled = true;
    }


    //Hook triggered by the getting of the accounts and used to display the value
    useEffect(() =>
    {
        if (my_address)
        {
            document.getElementById("My_Address").textContent = my_address;
            //console.log("set my address equal to " + my_address);
        }
    }, [my_address]);


    const initContract = async () =>
    {
        if (!HContract && web3_obj)
        {
            const new_contract = HitAndSunkContract(web3_obj);
            if (!new_contract) console.log("New contract not created during the initContract phase");
            setContract(new_contract);
            document.getElementById("Contract_Button").disabled = true;
        }
        else
        {
            console.log("Contract already binded");
            return;
        }
    }

    //Hook triggered by the setting of the contract that set the contract event listeners
    useEffect(() =>
    {
        if (HContract)
        {
            console.log("Setting contract event listeners");
            setContractEventListeners();
            bindEvents();
            init();
        }
    }, [HContract]);


    function bindEvents()
    {
        var button = document.getElementById("new-game-btn");
        button.onclick = function(){newGameFun();}
        button = document.getElementById("play-friend-btn");
        button.onclick = function(){newGameWithFriendFun();}
        button = document.getElementById("join-friend-btn");
        button.onclick = function(){joinFriendFun();}
        document.getElementById("input-field-btn").disabled = false;
        
        console.log("Buttons binded correctly");
    }


    function translation_state(state_ID)
    {
        if      (state_ID == 7) return "Player1 turn";
        else if (state_ID == 1) return "Player2 turn";
        else if (state_ID == 2) return "Verification Player1 Win";
        else if (state_ID == 3) return "Verification Player2 Win";
        else if (state_ID == 4) return "Finished";
        else if (state_ID == 5) return "Wait Player1 Outcome";
        else if (state_ID == 6) return "Wait Player2 Outcome";
        else if (state_ID == 0) return "Available";
        else if (state_ID == 8) return "Wait For Player";
        else if (state_ID == 9) return "Wait For Friend";
        else if (state_ID == 10) return "Decide Reward";
        else if (state_ID == 11) return "Wait Both Transactions";
        else if (state_ID == 12) return "Wait Player1 Transaction";
        else if (state_ID == 13) return "Wait Player2 Transaction";
        else if (state_ID == 14) return "Wait Both Disposition";
        else if (state_ID == 15) return "Wait Player1 Disposition";
        else if (state_ID == 16) return "Wait Player2 Disposition";
        else if (state_ID == 17) return "Match Over";
        else return "Don't know";
    }
    
    
    function checkContract()
    {
        if(HContract) return true;
        else
        {
            console.log("You should create a contract first.");
            return false;
        }
    }

    const newGameFun = async() =>
    {
        //console.log("Il valore di my_address è " + my_address + " il valore di web3_obj è" + web3_obj + " e il valore di HContract è " + HContract);
        if (checkContract())
        {
            try
            {
                HContract.methods.new_game().send({from: my_address});
                console.log("Called new game function");
            }
            catch(err)
            {
                console.log(err.message);
            };
        }        
    }


    const newGameWithFriendFun = async() =>
    {
        console.log("Starting to call a new game with friend");

        if (checkContract())
        {
            try
            {
                HContract.methods.new_game_with_friend().send({from: my_address});
                console.log("Called new game function");
            }
            catch(err)
            {
                console.log(err.message);
            };
        }  
    }


    const joinFriendFun = async() =>
    {
        console.log("join friend function called");
        if (checkContract())
        {
            try
            {
                var game_value = parseInt(document.getElementById("input_gaID").value);
                HContract.methods.join_friend(game_value).send({from: my_address});
                console.log("Called new game function");
            }
            catch(err)
            {
                console.log(err.message);
            };
        } 
    }


    function setContractEventListeners()
    {
        console.log("We are going to set the contract event listener");
        try
        {
            //console.log("Il valore di HContract ora è " + HContract);
            HContract.events.changeState().on("data", (event) =>
            {
                if (last_event_num >= event.blockNumber)
                {
                    console.log("We are receiving an already received event. Discard.");
                    return;
                }
                last_event_num = event.blockNumber;
                console.log(event);
                //MANAGEMENT OF THE EVENT CHANGE STATE
                if (event.returnValues["gaID"] != GaID) return;
                console.log("Change state event");
                console.log("The current state is: " + state);
                    
                var new_state_ID = parseInt(event.returnValues["new_state"]);
                if (state == wait_both_transactions || state == wait_player1_transaction || state == wait_player2_transaction)
                {
                    if (new_state_ID == wait_both_dispositions)
                    {
                        state = new_state_ID;
                        updateStateScreen();
                        
                        console.log("Both transactions are arrived");
                        /* code to abilitate the buttons for the disposition */
                        document.getElementById("input-field-title").textContent = "Set Disposition: the format is 'dimension cell direction(V or H)'.";
                        document.getElementById("input-field-btn").onclick = function(){setDisposition()};
                    }
                    else if(new_state_ID == wait_player1_transaction || wait_player2_transaction)
                    {
                        state = new_state_ID;
                        updateStateScreen();
                    }
                    else
                    {
                        console.log("Wrong state returned by the contract. Attention: there is an error");
                    }
                }
                else if (state == wait_both_dispositions || state == wait_player1_disposition || state == wait_player2_disposition)
                {
                    state = new_state_ID;
                    updateStateScreen();
                    if ((new_state_ID == wait_player1_disposition && player == 2) ||
                        (new_state_ID == wait_player2_disposition && player == 1) ||
                         new_state_ID == player1_turn)
                    {
                        document.getElementById("input-field-btn").onclick = function(){askToWin()};
                        document.getElementById("input-field-btn").disabled = false;
                        document.getElementById("input-field-title").textContent = "Write 'time' to ask for a win for abandonment";
                        if (new_state_ID == player1_turn)
                        {
                            document.getElementById("nsunk-text").textContent = "Number sunk: 0";
                            setHitButtons();
                            console.log("The game begin");
                        }
                    }
                }
                else if (state == wait_player1_outcome)
                {
                    if (new_state_ID != verification_player2_win)
                    {
                        console.log("Error during the game. The state obtained is not the one expected");
                        return;
                    }
                    state = new_state_ID;
                    updateStateScreen();
                    
                    if (player == 2) verificationProcedure();
                }
                else if (state == wait_player2_outcome)
                {
                    if (new_state_ID != verification_player1_win)
                    {
                        console.log("Error during the game. The state obtained is not the one expected");
                        return;
                    }
                    state = new_state_ID;
                    updateStateScreen();

                    if (player == 1) verificationProcedure();
                }
                else console.log("Cannot translate the current state!");
            });


            HContract.events.newGameInfo().on("data", (event) =>
            {
                if (last_event_num >= event.blockNumber)
                {
                    console.log("We are receiving an already received event. Discard.");
                    return;
                }
                last_event_num = event.blockNumber;
                console.log(event);
                //MANAGEMENT OF THE EVENT NEW_GAME_INFO
                if (state != no_state && state != wait_for_player && state != wait_for_friend)
                {
                    console.log("Unespected newGameInfo!");
                    return;
                }
                var game_ID = parseInt(event.returnValues[0]);
                var state_ID = parseInt(event.returnValues[1]);
                var obtained_address = parseInt(event.returnValues[2]);
                console.log("Fin qui tutto bene: abbiamo ottenuto " + game_ID.toString() + " e " + state_ID.toString());
                if (game_ID >= 0 && game_ID < num_games)
                {
                    console.log("gameID is in the correct range");
                    if (state == no_state && obtained_address == my_address)
                    {
                        console.log("We are in the case where there is not a game yet");
                        GaID = game_ID;
                        document.getElementById("game-ID-text").textContent = "Game ID: " + GaID.toString();
                        document.getElementById("new-game-btn").disabled = true;
                        document.getElementById("join-friend-btn").disabled = true;
                        document.getElementById("play-friend-btn").disabled = true;
                        document.getElementById("state-text").textContent = translation_state(state_ID);
                        
                        console.log("Lo stato è " + translation_state(state_ID));
                        if (state_ID == wait_for_player)
                        {
                            player = 1;
                        } 
                        else if (state_ID == decide_reward) 
                        {
                            player = 2;
                            document.getElementById("input-field-btn").onclick = function(){setReward()};
                            document.getElementById("input-field-btn").disabled = false;
                            document.getElementById("input-field-title").textContent = "Propose Reward";
                        }
                        else
                        {
                            console.log("Error during establishing a new game");
                            return;
                        }
                        state = state_ID;
                        updateStateScreen();
                        return;
                    }
                    else if ((state == wait_for_player || state == wait_for_friend) && GaID == game_ID)
                    {
                        console.log("We are in the case we are waiting for another player");
                        if (state_ID != decide_reward)
                        {
                            console.log("Error during the establishment of the game. The state obtained is not the one expected");
                            return;
                        }
                        var inp = document.getElementById('input-field-btn');
                        inp.onclick = function(){setReward();}
                        document.getElementById('input-field-title').textContent = "Propose Reward";
                        document.getElementById('input-field-btn').disabled = false;
                        state = state_ID;
                        updateStateScreen();
                    }
                    else
                    {
                        console.log("We had some error interpreting the newGameInfo event");
                    }
                }
            });

            HContract.events.changeReward().on("data", (event) =>
            {
                if (last_event_num >= event.blockNumber)
                {
                    console.log("We are receiving an already received event. Discard.");
                    return;
                }
                last_event_num = event.blockNumber;
                console.log(event);
                //MANAGEMENT OF THE EVENT CHANGE REWARD
                if (event.returnValues["gaID"] != GaID) return;
                if (state != decide_reward)
                {
                    console.log("Event of set reward outside of the reward decision time");
                    return;
                }
                console.log("The adversary have proposed a new reward: " + event.returnValues["new_reward"]);
                var event_player = parseInt(event.returnValues["player"]);
                var event_proposed_reward = parseInt(event.returnValues["new_reward"]);
                if (player != event_player) displayProposedReward(event_proposed_reward);
                else document.getElementById("input-field-title").textContent = "Propose Reward: we proposed " + event_proposed_reward.toString();
            });

            HContract.events.amountToPay().on("data", (event) =>
            {
                if (last_event_num >= event.blockNumber)
                {
                    console.log("We are receiving an already received event. Discard.");
                    return;
                }
                last_event_num = event.blockNumber;
                console.log(event);
                //MANAGEMENT OF THE REQUEST OF PAYMENT
                if (event.returnValues["gaID"] != GaID) return;
                console.log("Amount to pay event");
                if (state != decide_reward)
                {
                    console.log("Error during the setting of the reward. The state obtained is not the one expected");
                    return;
                }
                state = wait_both_transactions;
                updateStateScreen();
                var reward_value = Web3.utils.toWei(parseInt(event.returnValues["amount"]).toString());
                console.log("La ricompensa sarà di " + reward_value.toString() + " wei.");
                /* code to send the reward of the game */
                HContract.methods.send_transaction(player, GaID).send({from: my_address, value: reward_value});
                reward = parseInt(event.returnValues["amount"]);
                //DISPLAY THE AMOUNT SENT
                var game_text = document.getElementById("game-ID-text");
                var old_value = game_text.textContent;
                game_text.textContent = old_value + "; The stake is " + (parseInt(event.returnValues["amount"])*2).toString();
            });
            
            
            HContract.events.hitTried().on("data", (event) =>
            {
                if (last_event_num >= event.blockNumber)
                {
                    console.log("We are receiving an already received event. Discard.");
                    return;
                }
                last_event_num = event.blockNumber;
                console.log(event);

                //MANAGEMENT OF THE EVENT HIT_TRIED
                if (event.returnValues["gaID"] != GaID) return;
                var event_player = parseInt(event.returnValues["player"]);
                var event_cell = parseInt(event.returnValues["cell"]);
                if (event_player == player)
                {
                    if (player == 1) state = wait_player2_outcome;
                    else if (player == 2) state = wait_player1_outcome;
                    updateStateScreen();
                    return;
                }
                if (player == 1) state = wait_player1_outcome;
                else state = wait_player2_outcome;
                updateStateScreen();
                /* Code to test if the adversary hit it and sending of the proof to the smart contract */
                check_adversary_try(event_cell);
            });

            HContract.events.gotWater().on("data", (event) =>
            {
                if (last_event_num >= event.blockNumber)
                {
                    console.log("We are receiving an already received event. Discard.");
                    return;
                }
                last_event_num = event.blockNumber;
                console.log(event);
                
                //MANAGEMENT OF THE EVENT ABOUT THE WATER RESULT OF A TRY
                if (event.returnValues["gaID"] != GaID) return;
                var event_player = parseInt(event.returnValues["player"]);
                var event_cell = parseInt(event.returnValues["cell"]);
                if (player == event_player)
                {
                    if (player == 1) state = player1_turn;
                    else state = player2_turn;
                    updateStateScreen();
                }
                else
                {
                    if (opponent_playground[event_cell] != asked)
                    {
                        console.log("The answered cell is not the one we asked");
                    }
                    var cell_div = document.getElementById("adversary-cellbutton-" + event_cell.toString());
                    cell_div.setAttribute("class", styles.cells + " " + styles.adversarycell_water);
                    opponent_playground[event_cell] = water;
                
                    if (player == 2) state = player1_turn;
                    else state = player2_turn;
                    updateStateScreen();
                }
            });

            HContract.events.hitShip().on("data", (event) =>
            {
                if (last_event_num >= event.blockNumber)
                {
                    console.log("We are receiving an already received event. Discard.");
                    return;
                }
                last_event_num = event.blockNumber;
                console.log(event);                
                //MANAGEMENT OF THE EVENT ABOUT THE HIT RESULT OF A TRY
                if (event.returnValues["gaID"] != GaID) return;
                var event_player = parseInt(event.returnValues["player"]);
                var event_cell = parseInt(event.returnValues["cell"]);
                if (player != event_player)
                {
                    if (player == 1) state = player1_turn;
                    else state = player2_turn;
                    updateStateScreen();
                }
                else
                {
                    if (opponent_playground[event_cell] != asked)
                    {
                        console.log("The answered cell is not the one we asked");
                    }
                    var cell_div = document.getElementById("adversary-cellbutton-" + event_cell.toString());
                    cell_div.setAttribute("class", styles.cells +" "+ styles.adversarycell_fire);
                    opponent_playground[event_cell] = hit;
                
                    if (player == 1) state = player2_turn;
                    else state = player1_turn;
                    updateStateScreen();
                }                    
            });
            
            HContract.events.sunkShip().on("data", (event) =>
            {
                if (last_event_num >= event.blockNumber)
                {
                    console.log("We are receiving an already received event. Discard.");
                    return;
                }
                last_event_num = event.blockNumber;
                console.log(event);    

                //MANAGEMENT OF THE EVENT ABOUT THE SUNK RESULT OF A TRY
                if (event.returnValues["gaID"] != GaID) return;
                var event_player    = parseInt(event.returnValues["player"]);
                var event_cell      = parseInt(event.returnValues["cell"]);
                var event_direction = parseInt(event.returnValues["direction"]);
                var event_dimension = parseInt(event.returnValues["dimension"]);
                if (player != event_player)
                {
                    /* Code to update the adversary playground and the variables about the sunk ship*/
                    if (event_dimension == 1)
                    {
                        if (opponent_ship_1[2] == sunk)
                        {
                            console.log("We received an event saying that a ship already sunk has been sunk again");
                            return;
                        }
                        if (opponent_playground[event_cell] != asked)
                        {
                            console.log("We received an event saying that a cell not asked has been sunk");
                            return;
                        }
                        else console.log("We had the response about the cell we asked: it's a sunk");

                        opponent_playground[event_cell] = sunk;
                        opponent_ship_1 = [event_cell, S, sunk];
                        console.log("We have sunk an adversary ship");
                        
                        var cell_div = document.getElementById("adversary-cellbutton-"+event_cell.toString());
                        cell_div.setAttribute("class", styles.cells +" "+ styles.adversarycell_fire);
                    
                        if (player == 1) state = player2_turn;
                        else state = player1_turn;
                        updateStateScreen();
                        var sunk_div = document.getElementById("nsunk-text");
                        var length_text = sunk_div.textContent.length;
                        var new_sunk = parseInt(sunk_div.textContent[length_text-1])+1;
                        sunk_div.textContent = "Number Sunk: " + new_sunk.toString();
                        return;
                    }
                            
                        
                    if (event_direction == V) 
                    {
                        var num_asked = 0;
                    
                        //CHECK ON THE CORRECTNESS OF THE SUNK
                        for (var i = 0; i < event_dimension; i++)
                        {
                            if (opponent_playground[event_cell + dim_row*i] == asked) num_asked++;
                            if (opponent_playground[event_cell + dim_row*i] != asked && 
                                opponent_playground[event_cell + dim_row*i] != hit)
                            {
                                console.log("Error: an event of sunk ship arised but we didn't guess all the cells.");
                                return;
                            }
                        }
                        if (num_asked != 1)
                        {
                            console.log("Error: in the playground there is none or more than one cell asked");
                            return;
                        }

                        //NOW WE CAN UPDATE THE DATA STRUCTURE ABOUT THE SUNK
                        for (var i = 0; i < event_dimension; i++)
                        {
                            opponent_playground[event_cell+i*dim_row] = sunk;
                            var cell_div = document.getElementById("adversary-cellbutton-"+(event_cell+i*dim_row).toString());
                            cell_div.setAttribute("class", styles.cells + " " + styles.adversarycell_fire);
                        }                        
                    }
                    else if (event_direction == H)
                    {
                        var num_asked = 0;
                    
                        //CHECK ON THE CORRECTNESS OF THE SUNK
                        for (var i = 0; i < event_dimension; i++)
                        {
                            if (opponent_playground[event_cell + i] == asked) num_asked++;
                            if (opponent_playground[event_cell + i] != asked && 
                                opponent_playground[event_cell + i] != hit)
                            {
                                console.log("Error: an event of sunk ship arised but we didn't guess all the cells.");
                                return;
                            }
                        }
                        if (num_asked != 1)
                        {
                            console.log("Error: in the playground threre is more than one cell asked");
                            return;
                        }

                        //NOW WE CAN UPDATE THE DATA STRUCTURE ABOUT THE SUNK
                        for (var i = 0; i < event_dimension; i++)
                        {
                            opponent_playground[event_cell+i] = sunk;
                            var cell_div = document.getElementById("adversary-cellbutton-"+(event_cell+i).toString());
                            cell_div.setAttribute("class", styles.cells + " " + styles.adversarycell_fire);
                        }
                    }
                    else console.log("The direction is impossible to translate");
                
                    switch(event_dimension)
                    {
                        case 2:
                            if      (event_direction == V) opponent_ship_2 = [event_cell, S, sunk];
                            else if (event_direction == H) opponent_ship_2 = [event_cell, E, sunk];
                            else
                            {
                                console.log("Big Error: something bad happened during the sunk setting");
                                return;
                            }
                        break;
                        
                        case 3:
                            if      (event_direction == V) opponent_ship_3 = [event_cell, S, sunk];
                            else if (event_direction == H) opponent_ship_3 = [event_cell, E, sunk];
                            else
                            {
                                console.log("Big Error: something bad happened during the sunk setting");
                                return;
                            }
                        break;
                        
                        case 4:
                            if      (event_direction == V) opponent_ship_4 = [event_cell, S, sunk];
                            else if (event_direction == H) opponent_ship_4 = [event_cell, E, sunk];
                            else
                            {
                                console.log("Big Error: something bad happened during the sunk setting");
                                return;
                            }
                        break;
                        
                        case 5:
                            if      (event_direction == V) opponent_ship_5 = [event_cell, S, sunk];
                            else if (event_direction == H) opponent_ship_5 = [event_cell, E, sunk];
                            else
                            {
                                console.log("Big Error: something bad happened during the sunk setting");
                                return;
                            }
                        break;
                        
                        default:
                            console.log("Error: the dimension of the event is not been translated correctly");
                        return;
                    }
                
                    //ALL CORRECT: NOW WE CAN UPDATE THE STATE VARIABLE AND THE HTML PAGE
                    console.log("We have sunk an adversary ship");
                
                    if (player == 1) state = player2_turn;
                    else state = player1_turn;
                    //CODE TO UPDATE THE SCREEN ABOUT THE SHIP WE SUNK
                    var sunk_div = document.getElementById("nsunk-text");
                    var length_text = sunk_div.textContent.length;
                    var new_sunk = parseInt(sunk_div.textContent[length_text-1])+1;
                    sunk_div.textContent = "Number Sunk: " + new_sunk.toString();
                    updateStateScreen();
                }
                else
                {
                    //Information about our sunk ship are already set by the function that check the adversary try
                    console.log("Arrived the event about our ship sunk by the adversary")
                    if (player == 1) state = player1_turn;
                    else state = player2_turn;
                    updateStateScreen();
                }
            });

            HContract.events.cellVerified().on("data", (event) =>
            {
                if (last_event_num >= event.blockNumber)
                {
                    console.log("We are receiving an already received event. Discard.");
                    return;
                }
                last_event_num = event.blockNumber;
                console.log(event);

                //MANAGEMENT OF THE EVENT CELL VERIFIED
                if (event.returnValues["gaID"] != GaID) return;
                var event_player = parseInt(event.returnValues["player"]);
                if (event_player != player) return;

                num_verified--;
                if (num_verified == 0) sendVerificationSunk();
            });

            HContract.events.sunkVerified().on("data", (event) =>
            {
                if (last_event_num >= event.blockNumber)
                {
                    console.log("We are receiving an already received event. Discard.");
                    return;
                }
                last_event_num = event.blockNumber;
                if (event.returnValues["gaID"] != GaID) return;
                var event_dimension = parseInt(event.returnValues["dimension"]);
                console.log("Sunk Verified event comed. The ship verified is: " + event_dimension.toString());
            });

            HContract.events.abandonment_request().on("data", (event) =>
            {
                if (last_event_num >= event.blockNumber)
                {
                    console.log("We are receiving an already received event. Discard.");
                    return;
                }
                last_event_num = event.blockNumber;
                if (event.returnValues["gaID"] != GaID) return;
                var event_player = parseInt(event.returnValues["player"]);
                console.log("The player number " + event_player + " requested win for abandonment");
            });

            HContract.events.matchWinner().on("data", (event) =>
            {
                if (last_event_num >= event.blockNumber)
                {
                    console.log("We are receiving an already received event. Discard.");
                    return;
                }
                last_event_num = event.blockNumber;
                console.log(event);
                if (event.returnValues["gaID"] != GaID) return;
                var event_winner = event.returnValues["winner_player"];
                if (player == event_winner)
                {
                    var amount = 0;
                    if ((player == 1 && state == wait_player2_transaction)||(player == 2 && state == wait_player1_transaction)) amount = reward;
                    else amount = reward*2;

                    HContract.methods.withdraw_reward(GaID, amount).send({from: my_address});
                    alert("Congratulation! You won the game and withdraw the reward!");
                }
            });
        } catch (error)
        {
            console.log(error.message);
        }
    }

    const setReward = async () =>
    {
        var value = parseInt(document.getElementById("input-field-text").value);
        console.log("the value is " + value);
        console.log("The value of the input field is " + value.toString());
        if (value <= 0)
        {
            console.log("Error: the value " + value.toString() + " is not a possible value");
            return;
        }
        console.log("I valori mandati sono " + value + " " + player + " " + GaID);
        HContract.methods.set_reward(value, player, GaID).send({from: my_address});
        return;
    }


    const setDisposition = async () =>
    {
        var text = document.getElementById("input-field-text").value;
        console.log("In the set disposition phase, inside the input text there is " + text);
        var splitted_text = text.split(" ");

        //SANITIZATION OF THE INPUT FOR THE DISPOSITION
        if (splitted_text.length != 3)
        {
            console.log("Number of elements given in output is not correct");
            return;
        } 
        if (splitted_text[0].length != 1 || parseInt(splitted_text[0]) <= 0 || parseInt(splitted_text[0]) > 5)
        {
            console.log("Number of the dimension of the ship expressed is not valid");
            return;
        }
        if (splitted_text[1].length != 2 || !letter_set.includes(splitted_text[1][0]) || !number_set.includes(splitted_text[1][1]))
        {
            console.log("Value indicated for the initial cell is not valid: " + splitted_text[1]);
            return;
        }
        if (splitted_text[2].length != 1 || (splitted_text[2] != "V" && splitted_text[2] != "H"))
        {
            console.log("Value indicated for the direction of the ship is wrong: should be V or H");
            return;
        }
        
        //CHECK IF THE SHIP OF THIS DIMENSION IS BEEN ALREADY CHOSEN
        if (dimension == 1 && my_ship_1[1] != N)
        {
            alert("Ship of dimension 1 already set");
            return;
        }
        if (dimension == 2 && my_ship_2[1] != N)
        {
            alert("Ship of dimension 2 already set");
            return;
        }
        if (dimension == 3 && my_ship_3[1] != N)
        {
            alert("Ship of dimension 3 already set");
            return;
        }
        if (dimension == 4 && my_ship_4[1] != N)
        {
            alert("Ship of dimension 4 already set");
            return;
        }
        if (dimension == 5 && my_ship_5[1] != N)
        {
            alert("Ship of dimension 5 already set");
            return;
        }

        //CHECK IF THE CHOSEN PARAMETER GO OUT OF THE MATRIX OR OUT OF THE LINE
        var dimension = parseInt(splitted_text[0]);
        var direction = splitted_text[2];
        var ncell =  c_to_ncell(splitted_text[1]);

        if (direction == "V" && ncell+dim_row*(dimension-1) >= num_cells)
        {
            alert("The chosen parameter goes out of the matrix");
            return;
        }
        else if (direction == "H" && Math.floor((ncell+dimension-1)/dim_row) != Math.floor(ncell/dim_row))
        {
            alert("The chosen parameter goes out of the line chosen");
            return;
        }

        console.log(my_ship_1);
        //CHECK THAT THE CELLS CHOSEN ARE NOT ALREADY SELECTED BY ANOTHER SHIP SET
        if (direction == "V")
        {
            for (var i = 0; i < dimension; i++)
            {
                if (my_playground[ncell + i*dim_row] == ship)
                {
                    alert("The chosen parameters overlap with another ship already selected");
                    return;
                }
            }

            //IF WE ARRIVE HERE IT MEANS THAT ALL THE VALUES ARE CORRECT
            for (var i = 0; i < dimension; i++)
            {
                my_playground[ncell + i*dim_row] = ship;
                var cell_div = document.getElementById("my-cell-" + (ncell+i*dim_row).toString());
                if      (dimension == 1) cell_div.setAttribute("class", styles.my_ship_1 +" "+ styles.cells);
                else if (dimension == 2) cell_div.setAttribute("class", styles.my_ship_2 +" "+ styles.cells);
                else if (dimension == 3) cell_div.setAttribute("class", styles.my_ship_3 +" "+ styles.cells);
                else if (dimension == 4) cell_div.setAttribute("class", styles.my_ship_4 +" "+ styles.cells);
                else if (dimension == 5) cell_div.setAttribute("class", styles.my_ship_5 +" "+ styles.cells);
            }
            if      (dimension == 1) my_ship_1 = [ncell, S, safe];
            else if (dimension == 2) my_ship_2 = [ncell, S, safe];
            else if (dimension == 3) my_ship_3 = [ncell, S, safe];
            else if (dimension == 4) my_ship_4 = [ncell, S, safe];
            else if (dimension == 5) my_ship_5 = [ncell, S, safe];
        }
        else if (direction == "H")
        {
            console.log("We are mangaing the setting of an horizontal ship");
            for (var i = 0; i < dimension; i++)
            {
                if (my_playground[ncell + i] == ship)
                {
                    alert("The chosen parameters overlap with another ship already selected");
                    return;
                }
            }
            console.log("Checked the correctness of the selection");

            //IF WE ARRIVE HERE IT MEANS THAT ALL THE VALUES ARE CORRECT
            for (var i = 0; i < dimension; i++)
            {
                my_playground[ncell + i] = ship;
                var cell_div = document.getElementById("my-cell-" + (ncell+i).toString());
                if      (dimension == 1) cell_div.setAttribute("class", styles.my_ship_1 +" "+ styles.cells);
                else if (dimension == 2) cell_div.setAttribute("class", styles.my_ship_2 +" "+ styles.cells);
                else if (dimension == 3) cell_div.setAttribute("class", styles.my_ship_3 +" "+ styles.cells);
                else if (dimension == 4) cell_div.setAttribute("class", styles.my_ship_4 +" "+ styles.cells);
                else if (dimension == 5) cell_div.setAttribute("class", styles.my_ship_5 +" "+ styles.cells);
            }
            if      (dimension == 1) my_ship_1 = [ncell, E, safe];
            else if (dimension == 2) my_ship_2 = [ncell, E, safe];
            else if (dimension == 3) my_ship_3 = [ncell, E, safe];
            else if (dimension == 4) my_ship_4 = [ncell, E, safe];
            else if (dimension == 5) my_ship_5 = [ncell, E, safe];
        }
        console.log(my_ship_1);
        
        //CHECK IF ALL THE SHIPS ARE SET
        if (my_ship_1[1] != N && my_ship_2[1] != N &&
            my_ship_3[1] != N && my_ship_4[1] != N &&
            my_ship_5[1] != N)
        {
            console.log("all the ship are set");

            //PREPARATION OF THE MERKLE TREE

            console.log(my_playground);
            var seededGround = my_playground.map((elem, index) => elem + seeds[index]);
            console.log(seededGround);
            hashedGround = seededGround.map((selem) => Web3.utils.keccak256(Web3.utils.encodePacked(selem)));
            myMerkleTree = new MerkleTree(
                hashedGround,
                Web3.utils.keccak256,
                {
                    sortPairs: true,
                }
            );
            myMerkleRoot = myMerkleTree.getHexRoot();
            console.log(myMerkleTree.toString());
            console.log(myMerkleRoot);

            HContract.methods.commit_disposition(player, GaID, myMerkleRoot).send({from: my_address});
            console.log("Disposition Sent");

            my_ship_1[2] = safe;
            my_ship_2[2] = safe;
            my_ship_3[2] = safe;
            my_ship_4[2] = safe;
            my_ship_5[2] = safe;
        }
        else console.log("Disposition ship " + dimension.toString() + " set");
        console.log("The value of the my_ship are ");
        console.log(my_ship_1);
        console.log(my_ship_2);
        console.log(my_ship_3);
        console.log(my_ship_4);
        console.log(my_ship_5);
    }


    function setHitButtons()
    {
        for (var i = 0; i < num_cells; i++)
        {
            var cell_ele = document.getElementById("adversary-cellbutton-"+i.toString());
            cell_ele.disabled = false;
        }
    }


    const tryHit = async (hitValue) =>
    {
        if ((player == 1 && state != player1_turn) || (player == 2 && state != player2_turn))
        {
            alert("Wait for the adversary move");
            return;
        }
        console.log("You tried to hit " + hitValue);
        console.log("The adversary playground is: ");
        console.log(opponent_playground);
        if (opponent_playground[hitValue] != not_asked)
        {
            console.log("Strange behaviour. The button should be disabled..");
            return;
        }
        opponent_playground[hitValue] = asked;
        console.log("the player is " + player + ", while the game id is " + GaID);
        HContract.methods.try_hit(player, hitValue, GaID).send({from: my_address});
        document.getElementById("adversary-cell-" + hitValue.toString()).disabled = true;
    }


    function c_to_ncell(hitValue)
    {
        if (hitValue.length != 2 || !letter_set.includes(hitValue[0]) || !number_set.includes(hitValue[1]))
        {
            console.log("Error in the input of your try. Retry it!");
            return;
        }
        var num_col;
        if      (hitValue[0] == "A" || hitValue[0] == "a") num_col = 0;
        else if (hitValue[0] == "B" || hitValue[0] == "b") num_col = 1;
        else if (hitValue[0] == "C" || hitValue[0] == "c") num_col = 2;
        else if (hitValue[0] == "D" || hitValue[0] == "d") num_col = 3;
        else if (hitValue[0] == "E" || hitValue[0] == "e") num_col = 4;
        else if (hitValue[0] == "F" || hitValue[0] == "f") num_col = 5;
        else if (hitValue[0] == "G" || hitValue[0] == "g") num_col = 6;
        else if (hitValue[0] == "H" || hitValue[0] == "h") num_col = 7;
        else console.log("Something strange. Error in the input of your try. Retry it!");
        console.log("The offset is " + (parseInt(hitValue[1])-1)*dim_row + num_col);
        return (parseInt(hitValue[1])-1)*dim_row + num_col;
    }


    const check_adversary_try = async(cell_tried) =>
    {
        if ((player == 1 && state != wait_player1_outcome) || (player == 2 && state != wait_player2_outcome))
        {
            console.log("Error during execution: we received a try response request but it's not the adversary turn");
            return;
        }
        if (cell_tried < 0 || cell_tried >= num_cells)
        {
            console.log("Cell asked by the adversary is not in the range");
            return;
        }
        console.log("We are going to respond to the try request. The cell tried is " + cell_tried);
        var cell_div = document.getElementById("my-cell-"+cell_tried.toString());
        var cell_class = cell_div.getAttribute("class");
        cell_div.setAttribute("class", cell_class + " " + styles.tried);
        
        switch(my_playground[cell_tried])
        {
            case water:
                console.log("The cell tried is water");

                //LATER WE SHOULD REMEMBER TO IMPLEMENT THE MECHANISM WITH THE MERKLE TREE
                var proof = myMerkleTree.getHexProof(hashedGround[cell_tried]);
                var leafSeed = seeds[cell_tried];

                console.log("The value used are: player, cell, game_ID, equal to " + player + " " + cell_tried + " " + GaID);

                HContract.methods.outcome_water(proof, leafSeed, player, cell_tried, GaID).send({from: my_address});
            break;

            case ship:
                console.log("The cell tried is a ship");
                my_playground[cell_tried] = hit;

                // VARIABLE OF THE MERKLE TREE
                var proof = myMerkleTree.getHexProof(hashedGround[cell_tried]);
                var leafSeed = seeds[cell_tried];

                /*console.log("Set the merkle tree variables");
                console.log("The values on my_ship_1 is ");
                console.log(my_ship_1);*/

                if (my_ship_1[2] == safe && my_ship_1[0] == cell_tried)
                {
                    console.log("Met first condition");
                    my_playground[cell_tried] = sunk;
                    my_ship_1[2] = sunk;

                    console.log("Going to call the method");
                    HContract.methods.outcome_sunk(proof, leafSeed, player, cell_tried, 1, S, GaID).send({from: my_address});
                    console.log("Method called");
                    return;
                }
                else if (my_ship_2[2] == safe && check_membership(cell_tried, 2))
                {
                    var num_not_hit = 0;
                    if (my_ship_2[1] == H) for (var i = 0; i < 2; i++) if (my_playground[my_ship_2[0]+i] != hit) num_not_hit++;
                    if (my_ship_2[1] == V) for (var i = 0; i < 2; i++) if (my_playground[my_ship_2[0]+i*dim_row] != hit) num_not_hit++;
                    if (num_not_hit != 0)
                    {
                        console.log("The ship has been hit but not been sunk");
                        //TO INSERT MERKLE ROOT
                        HContract.methods.outcome_hit(proof, leafSeed, player, cell_tried, GaID).send({from: my_address});
                        return;
                    }
                    else
                    {
                        //UPDATE THE PLAYGROUND SETTING AS SUNK
                        if (my_ship_2[1] == V) for (var i = 0; i < 2; i++) my_playground[my_ship_2[0]+i*dim_row] = sunk;
                        if (my_ship_2[1] == H) for (var i = 0; i < 2; i++) my_playground[my_ship_2[0]+i] = sunk;
                        my_ship_2[2] = sunk;

                        HContract.methods.outcome_sunk(proof, leafSeed, player, my_ship_2[0], 2, my_ship_2[1], GaID).send({from: my_address});
                        return;
                    }
                }
                else if (my_ship_3[2] == safe && check_membership(cell_tried, 3))
                {
                    var num_not_hit = 0;
                    if (my_ship_3[1] == H) for (var i = 0; i < 3; i++) if (my_playground[my_ship_3[0]+i] != hit) num_not_hit++;
                    if (my_ship_3[1] == V) for (var i = 0; i < 3; i++) if (my_playground[my_ship_3[0]+i*dim_row] != hit) num_not_hit++;
                    if (num_not_hit != 0)
                    {
                        console.log("The ship has been hit but not been sunk");
                        //TO INSERT MERKLE ROOT
                        HContract.methods.outcome_hit(proof, leafSeed, player, cell_tried, GaID).send({from: my_address});
                        return;
                    }
                    else
                    {
                        //UPDATE THE PLAYGROUND SETTING AS SUNK
                        if (my_ship_3[1] == V) for (var i = 0; i < 3; i++) my_playground[my_ship_3[0]+i*dim_row] = sunk;
                        if (my_ship_3[1] == H) for (var i = 0; i < 3; i++) my_playground[my_ship_3[0]+i] = sunk;
                        my_ship_3[2] = sunk;

                        HContract.methods.outcome_sunk(proof, leafSeed, player, my_ship_3[0], 3, my_ship_3[1], GaID).send({from: my_address});
                        return;
                    }
                }
                else if (my_ship_4[2] == safe && check_membership(cell_tried, 4))
                {
                    var num_not_hit = 0;
                    if (my_ship_4[1] == H) for (var i = 0; i < 4; i++) if (my_playground[my_ship_4[0]+i] != hit) num_not_hit++;
                    if (my_ship_4[1] == V) for (var i = 0; i < 4; i++) if (my_playground[my_ship_4[0]+i*dim_row] != hit) num_not_hit++;
                    if (num_not_hit != 0)
                    {
                        console.log("The ship has been hit but not been sunk");
                        //TO INSERT MERKLE ROOT
                        HContract.methods.outcome_hit(proof, leafSeed, player, cell_tried, GaID).send({from: my_address});
                        return;
                    }
                    else
                    {
                        //UPDATE THE PLAYGROUND SETTING AS SUNK
                        if (my_ship_4[1] == V) for (var i = 0; i < 4; i++) my_playground[my_ship_4[0]+i*dim_row] = sunk;
                        if (my_ship_4[1] == H) for (var i = 0; i < 4; i++) my_playground[my_ship_4[0]+i] = sunk;
                        my_ship_4[2] = sunk;

                        HContract.methods.outcome_sunk(proof, leafSeed, player, my_ship_4[0], 4, my_ship_4[1], GaID).send({from: my_address});
                        return;
                    }
                }
                else if (my_ship_5[2] == safe && check_membership(cell_tried, 5))
                {
                    var num_not_hit = 0;
                    if (my_ship_5[1] == H) for (var i = 0; i < 5; i++) if (my_playground[my_ship_5[0]+i] != hit) num_not_hit++;
                    if (my_ship_5[1] == V) for (var i = 0; i < 5; i++) if (my_playground[my_ship_5[0]+i*dim_row] != hit) num_not_hit++;
                    if (num_not_hit != 0)
                    {
                        console.log("The ship has been hit but not been sunk");
                        //TO INSERT MERKLE ROOT
                        HContract.methods.outcome_hit(proof, leafSeed, player, cell_tried, GaID).send({from: my_address});
                        return;
                    }
                    else
                    {
                        //UPDATE THE PLAYGROUND SETTING AS SUNK
                        if (my_ship_5[1] == V) for (var i = 0; i < 5; i++) my_playground[my_ship_5[0]+i*dim_row] = sunk;
                        if (my_ship_5[1] == H) for (var i = 0; i < 5; i++) my_playground[my_ship_5[0]+i] = sunk;
                        my_ship_5[2] = sunk;

                        HContract.methods.outcome_sunk(proof, leafSeed, player, my_ship_5[0], 5, my_ship_5[1], GaID).send({from: my_address});
                        return;
                    }
                }
                else console.log("Something wrong gone during the game");
                
            break;

            default:
                console.log("Error in the try of the adversary");
            break;
        }
    }


    function check_membership(cell_tried, dimension)
    {
        console.log("Check for dimension " + dimension);
        if (dimension == 2)
        {
            if (my_ship_2[1] == H)
            {
                for (var i = 0; i < dimension; i++) if (my_ship_2[0]+i == cell_tried) return true;
            }
            else if (my_ship_2[1] == V)
            {
                for (var i = 0; i < dimension; i++) if (my_ship_2[0]+i*dim_row == cell_tried) return true;
            }
        }
        else if (dimension == 3)
        {
            if (my_ship_3[1] == H)
            {
                for (var i = 0; i < dimension; i++) if (my_ship_3[0]+i == cell_tried) return true;
            }
            else if (my_ship_3[1] == V)
            {
                for (var i = 0; i < dimension; i++) if (my_ship_3[0]+i*dim_row == cell_tried) return true;
            }
        }
        else if (dimension == 4)
        {
            if (my_ship_4[1] == H)
            {
                for (var i = 0; i < dimension; i++) if (my_ship_4[0]+i == cell_tried) return true;
            }
            else if (my_ship_4[1] == V)
            {
                for (var i = 0; i < dimension; i++) if (my_ship_4[0]+i*dim_row == cell_tried) return true;
            }
        }
        else if (dimension == 5)
        {
            if (my_ship_5[1] == H)
            {
                for (var i = 0; i < dimension; i++) if (my_ship_5[0]+i == cell_tried) return true;
            }
            else if (my_ship_5[1] == V)
            {
                for (var i = 0; i < dimension; i++) if (my_ship_5[0]+i*dim_row == cell_tried) return true;
            }
        }
        else return false;
    }


    const askToWin = async () =>
    {
        if (document.getElementById("input-field-text").value == "time");
        {
            alert("We are requesting to the smart contract for a win due to adversary abandonment");
            HContract.methods.adversary_quit(GaID, player).send({from: my_address});
            console.log("Sent request about adversary quit");
        }
    }

    
    function updateStateScreen()
    {
        console.log("We are updating the screen");
        document.getElementById("state-text").textContent = translation_state(state);
    }


    function displayProposedReward(reward)
    {
        console.log("The adversary proposed a new reward: " + reward.toString() + "\nPropose the same reward to accept it!\n");
        document.getElementById("input-field-title").textContent = "Propose Reward: the last propose of the adversary is " + reward.toString();
    }

    const verificationProcedure = async () =>
    {
        //SETTING OF THE VARIABLE NUM_VERIFIED
        if (my_ship_1[2] == safe) num_verified = 1;
        else num_verified = 0;
        if (my_ship_2[2] == safe) num_verified += 2;
        if (my_ship_3[2] == safe) num_verified += 3;
        if (my_ship_4[2] == safe) num_verified += 4;
        if (my_ship_5[2] == safe) num_verified += 5;

        //SENDING THE VERIFICATION TO THE SMART CONTRACT
        if (my_ship_1[2] == safe)
        {
            //CODE TO PROVE THE POSITION OF SHIP 1
            var proof = myMerkleTree.getHexProof(hashedGround[my_ship_1[0]]);
            var leafSeed = seeds[my_ship_1[0]];
            HContract.methods.verify_cell(proof, leafSeed, player, my_ship_1[0], GaID).send({from: my_address});
        }
        if (my_ship_2[2] == safe)
        {
            //CODE TO PROVE THE POSITION OF SHIP 2
            for (var i = 0; i < 2; i++)
            {
                if (my_ship_2[1] == V) 
                {
                    var proof = myMerkleTree.getHexProof(hashedGround[my_ship_2[0] + i*dim_row]);
                    var leafSeed = seeds[my_ship_2[0] + i*dim_row];
                    HContract.methods.verify_cell(proof, leafSeed, player, my_ship_2[0] + i*dim_row, GaID).send({from: my_address});
                }
                else 
                {
                    var proof = myMerkleTree.getHexProof(hashedGround[my_ship_2[0] + i]);
                    var leafSeed = seeds[my_ship_2[0] + i];
                    HContract.methods.verify_cell(proof, leafSeed, player, my_ship_2[0] + i, GaID).send({from: my_address});
                }             
            } 
        }
        if (my_ship_3[2] == safe)
        {
            //CODE TO PROVE THE POSITION OF SHIP 3
            for (var i = 0; i < 3; i++)
            {
                if (my_ship_3[1] == V) 
                {
                    var proof = myMerkleTree.getHexProof(hashedGround[my_ship_3[0] + i*dim_row]);
                    var leafSeed = seeds[my_ship_3[0] + i*dim_row];
                    HContract.methods.verify_cell(proof, leafSeed, player, my_ship_3[0] + i*dim_row, GaID).send({from: my_address});
                }
                else 
                {
                    var proof = myMerkleTree.getHexProof(hashedGround[my_ship_3[0] + i]);
                    var leafSeed = seeds[my_ship_3[0] + i];
                    HContract.methods.verify_cell(proof, leafSeed, player, my_ship_3[0] + i, GaID).send({from: my_address});
                }             
            } 
        }
        if (my_ship_4[2] == safe)
        {
            //CODE TO PROVE THE POSITION OF SHIP 4
            for (var i = 0; i < 4; i++)
            {
                if (my_ship_4[1] == V) 
                {
                    var proof = myMerkleTree.getHexProof(hashedGround[my_ship_4[0] + i*dim_row]);
                    var leafSeed = seeds[my_ship_4[0] + i*dim_row];
                    HContract.methods.verify_cell(proof, leafSeed, player, my_ship_4[0] + i*dim_row, GaID).send({from: my_address});
                }
                else 
                {
                    var proof = myMerkleTree.getHexProof(hashedGround[my_ship_4[0] + i]);
                    var leafSeed = seeds[my_ship_4[0] + i];
                    HContract.methods.verify_cell(proof, leafSeed, player, my_ship_4[0] + i, GaID).send({from: my_address});
                }             
            } 
        }
        if (my_ship_5[2] == safe)
        {
            //CODE TO PROVE THE POSITION OF SHIP 5
            for (var i = 0; i < 5; i++)
            {
                if (my_ship_5[1] == V) 
                {
                    var proof = myMerkleTree.getHexProof(hashedGround[my_ship_5[0] + i*dim_row]);
                    var leafSeed = seeds[my_ship_5[0] + i*dim_row];
                    HContract.methods.verify_cell(proof, leafSeed, player, my_ship_5[0] + i*dim_row, GaID).send({from: my_address});
                }
                else 
                {
                    var proof = myMerkleTree.getHexProof(hashedGround[my_ship_5[0] + i]);
                    var leafSeed = seeds[my_ship_5[0] + i];
                    HContract.methods.verify_cell(proof, leafSeed, player, my_ship_5[0] + i, GaID).send({from: my_address});
                }             
            } 
        }
    }


    const sendVerificationSunk = async () =>
    {
        if (my_ship_1[2] == safe)
        {
            HContract.methods.verify_sunk(player, my_ship_1[0], my_ship_1[1], 1, GaID).send({from: my_address});
            my_ship_1[2] = sunk;
        }
        if (my_ship_2[2] == safe)
        {
            HContract.methods.verify_sunk(player, my_ship_2[0], my_ship_2[1], 2, GaID).send({from: my_address});
            my_ship_2[2] = sunk;
        }
        if (my_ship_3[2] == safe)
        {
            HContract.methods.verify_sunk(player, my_ship_3[0], my_ship_3[1], 3, GaID).send({from: my_address});
            my_ship_3[2] = sunk;
        }
        if (my_ship_4[2] == safe)
        {
            HContract.methods.verify_sunk(player, my_ship_4[0], my_ship_4[1], 4, GaID).send({from: my_address});
            my_ship_4[2] = sunk;
        }
        if (my_ship_5[2] == safe)
        {
            HContract.methods.verify_sunk(player, my_ship_5[0], my_ship_5[1], 5, GaID).send({from: my_address});
            my_ship_5[2] = sunk;
        }
    }


    return (
            <div>
            <Head>
                <meta charSet="utf-8"/>
                <meta httpEquiv="X-UA Compatible" content="IE=edge"/>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <title>Hit And Sunk!</title>
            </Head>

            <main className={styles.main}>
                <div className="container">
                    <div id="title-container">
                        <h1 className="title has-text-centered is-size-1"id="title-text">Hit And Sunk!</h1>
                        <hr/>
                    </div>
                </div>

                <nav className="navbar has-shadow py-1 is-primary mb-2">
                <div className="navbar-start">
                    <a className="navbar-item">
                        <button className = "button is-info is-medium" id="Web3-button" onClick={initWeb3}>
                        Connect your wallet
                        </button>
                    </a>
                    <a className="navbar-item">
                        <button className = "button is-info is-medium" id="Contract_Button" onClick={initContract}>
                        Create Hit And Sunk
                        </button>
                    </a>
                    <a className="navbar-item is-size-6">
                    Wallet Address: 
                    <h1 className="is-ligth" id="My_Address"/>
                    </a>
                </div>

                <div className="navbar-end">
                    <a className="navbar-item" id="new-game">
                        <button className = "button is-info is-medium" id="new-game-btn">New Game</button>
                    </a>
                    <a className="navbar-item" id="play-friend">
                        <button className = "button is-info is-medium" id="play-friend-btn">Play with a friend</button>
                    </a>
                    <a className="join-friend navbar-item">
                        <input id="input_gaID" type="text"/>
                        <button className = "button is-info is-medium" id="join-friend-btn">Join a friend</button>
                    </a>
                </div>
                </nav>

                <div className="container has-text-centered py-6">
                    <p id ="state-text" className= "title is-3">Initial State: no game found</p>
                    <p className="subtitle is-5" id = "game-ID-text">Game ID: none</p>
                    <p className="subtitle is-5" id = "nsunk-text"></p>
                </div>

                <div id="playgrounds">
                    <div id={styles.my_playground_div}>
                        <p id="my-playground-text" className="title is-5"></p>
                        <div id="owner-playground" className={styles.playground}></div>
                    </div>
                    <div id={styles.ad_playground_div}>
                        <p id="ad-playground-text" className="title is-5"></p>
                        <div id="adversary-playground" className={styles.playground}></div>
                    </div>
                </div>
        
                <div id="input-field" className="container has-text-centered pb-6">
                    <p className="title is-3 py-2" id="input-field-title">Input field</p>
                    <input id="input-field-text" type="text"/>
                    <button className = "button is-primary is-small" id="input-field-btn" type="button">Submit</button>
                </div>


            </main>
            </div>
    )
}
