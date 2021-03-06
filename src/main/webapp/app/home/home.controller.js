(function() {
    'use strict';

    angular
        .module('iaserversnorkunkingApp')
        .controller('HomeController', HomeController);

    HomeController.$inject = ['$scope', 'Principal', 'LoginService', '$state',
                              'IAConnectorGame', 'IAConnectorService', 'IAConnectorSocketService'];

    function HomeController ($scope, Principal, LoginService, $state,
                            IAConnectorGame, IAConnectorService, IAConnectorSocketService) {

        $scope.currentPlayers = {};
        function loadCurrentPlayers() {
            var currentPlayerString = localStorage.getItem("currentPlayers");
            if (!currentPlayerString) {
                $scope.currentPlayers = {};
            } else {
                $scope.currentPlayers = JSON.parse(currentPlayerString);
            }
        }
        loadCurrentPlayers();

        console.log("$scope.currentPlayers", $scope.currentPlayers);

        function getCurrentKeyFromGame(idGame) {
            var currentPlayersKey = [];
            for (var key in $scope.currentPlayers) {
                if (getIdGameFromKey(key) == idGame) {
                    currentPlayersKey.push(key);
                }
            }
            return currentPlayersKey;
        }

        function getPlayerTurnIdFromKey(key) {
            return key.split("#")[1];
        }

        function getIdGameFromKey(key) {
            return key.split("#")[0];
        }

        //=====================================================================
        //= Reboot
        //=====================================================================
        $scope.reboot = function() {
            IAConnectorService.init();
            localStorage.clear();
            loadCurrentPlayers();
            $scope.games = undefined;
            $scope.refreshGameList();
        }
        //=====================================================================
        // Sockets.
        //=====================================================================
        IAConnectorSocketService.connect();
        IAConnectorSocketService.receive().then(null, null, function(game) {
            console.log("from socket", game);
            if ($scope.currentIdGame != game.idGame) {
                return;
            }
            refreshGame(game);
        });
        IAConnectorSocketService.subscribe();
        IAConnectorSocketService.subscribeRefreshAllGames();

        IAConnectorSocketService.receiveAllGames().then(null, null, function(allGames) {
            $scope.games = allGames;
            console.log("from socket allGames", allGames);
        })


        var vm = this;
        $scope.currentGame;
        $scope.currentIdGame;

        $scope.createGame = function() {

            IAConnectorService.createGame()
                .then(function(res) {
                    var game = res.data;
                    console.log("Game is : " + JSON.stringify(game));
                    $scope.currentGame = game;
                    $scope.refreshGameList();
                    $scope.currentIdGame = game.idGame;
                })

        }

        $scope.selectGame = function(idGame) {
            console.log(idGame);
            IAConnectorGame
                .get({idGame : idGame})
                .$promise.then(refreshGame);;
        }

        function refreshGame(currentGame) {
            console.log(currentGame);
            $scope.currentIdGame = currentGame.idGame;
            $scope.currentGame = currentGame;
            initMove();
            getSecrets();
            refreshUI();
        }

        /**
         * Gets Secrets
         */
         function getSecrets() {
            var currentPlayersKey = getCurrentKeyFromGame($scope.currentIdGame);
            console.log(currentPlayersKey);
            for (var index in currentPlayersKey) {
                getSecret(currentPlayersKey[index])
            }
         }

         function getSecret(key) {
            IAConnectorService
                .getSecrets($scope.currentPlayers[key], addSecretToCurrentGame.bind(this, key))
         }

        function addSecretToCurrentGame(key, res) {
            var secret = res.data;
            var playerIndex = getPlayerTurnIdFromKey(key);
            for (var index in $scope.currentGame.players) {
                if (playerIndex == index) {
                    var player = $scope.currentGame.players[index];
                    player.program = secret.program;
                    player.handCards = secret.handCards;
                }
            }
        }

        /**
         * Refresh List of Games.
         */
        $scope.refreshGameList = function(callback) {
            console.log("get game list");
            IAConnectorService.getGames(function(res) {
                var games = res.data
                if (!$scope.games) {
                    $scope.selectGame(games[0]);
                }
                $scope.games = games;
                console.log($scope.games);
                refreshUI();
            })
        }
        $scope.refreshGameList();

        function refreshUI() {
            setTimeout(setGameListHeight, 200);
            setTimeout(setGameListHeight, 1000);
        }
        function setGameListHeight() {
            var newSize = $(window).height() - $("#game-container").position().top;
            newSize = Math.max(newSize, 200)
            $("#game-container").height(newSize);
        }



        function refreshCurrentGame() {
            $scope.selectGame($scope.currentIdGame);
        }

        $scope.startGame = function() {
            var idGame = $scope.currentIdGame;
            IAConnectorService
                    .startGame(idGame)
                    .then(refreshCurrentGame);
        }

        $scope.playerName =  chance.name({ nationality: "it" })

        $scope.shouldSeeInfo = function(player, playerIndex) {
            for (var key in $scope.currentPlayers) {
                var idPlayerTurn = getPlayerTurnIdFromKey(key);
                var idGame = getIdGameFromKey(key);
                if ($scope.currentIdGame == idGame
                    && idPlayerTurn == playerIndex) {
                    return true;
                }
            }
            return false;
        }


        $scope.addPlayer= function() {
            var idGame = $scope.currentIdGame;
            var playerName = $("#playerName").val()
            $scope.playerName =  chance.name({ nationality: "it" })

            IAConnectorService.addPlayer(idGame, playerName, function(response) {
                var playerInstance = response.data
                var idPlayerTurn = playerInstance.idPlayer;
                var key = getKey(idGame, idPlayerTurn);
                $scope.currentPlayers[key] = playerInstance.UUID || playerInstance.uuid;
                localStorage.setItem("currentPlayers", JSON.stringify($scope.currentPlayers));

                refreshCurrentGame();
            })
        }

        $scope.sendMove = function(idPlayerTurn) {
            var playerUUID = $scope.currentPlayers[getKey($scope.currentIdGame, idPlayerTurn)];
            console.log($scope.moveToSend);
            IAConnectorService.sendMove(playerUUID, $scope.moveToSend).then(
                function(response) {
                    refreshCurrentGame();
                }, function(response) {
                    console.log("response", response);
                    refreshCurrentGame();
                    alert(JSON.stringify(response.data));
                }
            )
            initMove();
        }

        function getKey(idGame, idPlayerTurn) {
            return idGame + "#" + idPlayerTurn;
        }

        $scope.isCurrentPlayer = function(currentIdGame, idPlayerTurn) {
            return $scope.currentPlayers[getKey(currentIdGame, idPlayerTurn)]
        }

        $scope.isPlayerTurn = function(game, idPlayerTurn) {
            return game.started && game.currentIdPlayerTurn == idPlayerTurn && !game.finished;
        }


        $scope.getPlayersInCell = function(cellIndex, levelIndex, caveIndex) {
            var playersInCell = []
            for (var i = 0; i < $scope.currentGame.players.length; i++) {
                var player = $scope.currentGame.players[i]
                if (player.caveIndex == caveIndex && player.levelIndex == levelIndex &&
                        player.cellIndex == cellIndex) {
                    player.index = i;
                    playersInCell.push(player)
                }
            }
            return playersInCell;
        }

        $scope.getPlayersAtSurface = function() {
            var playersAtSurface = []
            if (!$scope.currentGame) return []
            for (var i = 0; i < $scope.currentGame.players.length; i++) {
                var player = $scope.currentGame.players[i];
                if (player.caveIndex == null && player.levelIndex == null) {
                    player.index = i;
                    playersAtSurface.push(player)
                }
            }
            return playersAtSurface;
        }

        $scope.getPlayerNumber = function(player) {
            for (var i = 0; i < $scope.currentGame.players.length; i++) {
                var currentPlayer = $scope.currentGame.players[i];
                if (player.playerName == currentPlayer.playerName) {
                    return (i + 1);
                }
            }
            return -1;
        }

        // ============================================================================================================
        // Choose Moves:
        // ============================================================================================================
        $scope.steps = {
            "chooseMoveStep" : true,
            "buildMoveStep" : false,
            "chooseCardsStep" : false,
            "foldCardsStep" : false
        }

        function changeStep(stepName) {
            for (var step in $scope.steps) {
                $scope.steps[step] = false;
            }
            $scope.steps[stepName] = true;
        }

        function initMove() {
            changeStep("chooseMoveStep");
            $scope.moveToSend = "";
            $scope.wallType = "";
            $scope.wallPosition = undefined;
            $scope.currentProgram = [];
            $scope.currentCardToFold = [];
        }
        initMove();
        $scope.chooseMove = function(moveNumber) {
            $scope.moveToSend = moveNumber + ";"
            if (moveNumber == 1) {
                changeStep("chooseCardsStep");
            } else if (moveNumber == 2) {
                changeStep("buildMoveStep");
            } else {
                $scope.moveToSend += ";"
                changeStep("foldCardsStep");
            }
        }

        $scope.chooseWall = function(WallType) {
            $scope.wallType = WallType;
        }

        $scope.chooseWallPosition = function(line, column) {
            if (!$scope.steps.buildMoveStep) {
                return;
            }
            if (!($scope.wallPosition && $scope.wallPosition.line == line && $scope.wallPosition.column == column)) {
                if ($scope.currentGame.grid.grid[line][column].panelName != 'EMPTY') {
                    return;
                }
            }
            if ($scope.wallPosition) {
                $scope.currentGame.grid.grid[$scope.wallPosition.line][$scope.wallPosition.column].panelName = "EMPTY";
            }
            console.log(line, column)
            $scope.wallPosition = {
                "line" : line,
                "column" : column
            };
            $scope.currentGame.grid.grid[line][column] = { panelName : $scope.wallType}
        }

        $scope.validateWallPosition = function() {
            $scope.moveToSend += upperCaseFirst($scope.wallType) + " on " + $scope.wallPosition.line + "-" + $scope.wallPosition.column + ";";
            changeStep("foldCardsStep");
        }

        $scope.clickOnCardInHand = function(cardIndex, playerIndex) {
            var card = $scope.currentGame.players[playerIndex].handCards[cardIndex];
            if ($scope.steps.chooseCardsStep) {
                $scope.currentGame.players[playerIndex].handCards.splice(cardIndex, 1);
                $scope.currentProgram.push(card);
            } else if ($scope.steps.foldCardsStep) {
                $scope.currentGame.players[playerIndex].handCards.splice(cardIndex, 1);
                $scope.currentCardToFold.push(card);
            }
        }

        $scope.clickOnCardProgram = function(cardIndex, playerIndex) {
            $scope.currentGame.players[playerIndex].handCards.push($scope.currentProgram[cardIndex]);
            $scope.currentProgram.splice(cardIndex, 1);
        }

        $scope.clickOnCardToFold = function(cardIndex, playerIndex) {
            $scope.currentGame.players[playerIndex].handCards.push($scope.currentCardToFold[cardIndex]);
            $scope.currentCardToFold.splice(cardIndex, 1);
        }

        $scope.validateCardToFold = function(playerIndex) {
            for (var i = 0; i < $scope.currentCardToFold.length; i++) {
                $scope.moveToSend += $scope.currentCardToFold[i].cardName.charAt(0);
            }
            $scope.sendMove(playerIndex);
        }

        $scope.validateCardProgram = function() {
            for (var i = 0; i < $scope.currentProgram.length; i++) {
                $scope.moveToSend += $scope.currentProgram[i].cardName.charAt(0);
            }
            $scope.moveToSend += ";";
            changeStep("foldCardsStep");
        }

        function upperCaseFirst(string) {
            return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
        }

        // ============================================================================================================
        // Grid :
        // ============================================================================================================


        $scope.displayRecordDate = function(record) {
            var date = new Date(record.date);
            var displayedDate = "";
            displayedDate += date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
            if (record.turnNumber == 0) {
                displayedDate += " (the "
                + (date.getUTCDate() < 10 ? "0" : "")+ date.getUTCDate() + "/"
                + (date.getUTCMonth() + 1 < 10 ? "0" : "") + (date.getUTCMonth() + 1) + "/"
                + date.getUTCFullYear() + ")";
            }
            return displayedDate;
        }

        $scope.changeGrid = function(inc) {
            $scope.currentGame.turnCount = $scope.currentGame.turnCount + inc;
            document.querySelector("#moveRecords" + $scope.currentGame.turnCount).scrollIntoView({ behavior: 'smooth' })
        }

        $scope.getGridToDisplay = function() {
            if ($scope.currentGame.turnCount == $scope.currentGame.gridHistory.length) {
                return $scope.currentGame.grid.grid;
            } else {
                return $scope.currentGame.gridHistory[$scope.currentGame.turnCount].grid;
            }
        }



    }


})();
