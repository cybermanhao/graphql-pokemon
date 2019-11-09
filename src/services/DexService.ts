import { Arg, Args } from 'type-graphql';
import FuzzySearch from '../utils/FuzzySearch';
import pokedex from '../assets/pokedex';
import { pokedexAliases } from '../assets/aliases';
import Pokemon from '../typings/pokemon';
import { SimpleFuseOptions } from '../typings/common';
import DexDetails from '../structures/DexDetails';
import DexEntry from '../structures/DexEntry';
import { GraphQLJSONObject } from 'graphql-type-json';
import GenderEntry from '../structures/GenderEntry';
import Util from '../utils/util';
import AbilitiesEntry from '../structures/AbilitiesEntry';
import StatsEntry from '../structures/StatsEntry';
import FlavorEntry from '../structures/FlavorEntry';
import PokemonPaginatedArgs from '../arguments/PokemonPaginatedArgs';

export default class DexService {
  public findByNum(@Arg('num') num: number) {
    return pokedex.find(poke => poke.num === num);
  }

  public findBySpecies(@Arg('species') species: string) {
    return pokedex.get(species);
  }

  public findByFuzzy(@Args() {
    pokemon, skip, take, reverse,
  }: PokemonPaginatedArgs, @Arg('fuseOptions', () => GraphQLJSONObject) fuseOptions?: SimpleFuseOptions) {
    if (pokemon.split(' ')[0] === 'mega') {
      pokemon = `${pokemon.substring(pokemon.split(' ')[0].length + 1)}-mega`;
    }

    const queryResults: DexEntry[] = [];
    const fuzzyPokemon = new FuzzySearch(pokedex, [ 'num', 'species' ], { threshold: 0.3, ...fuseOptions });

    let fuzzyResult = fuzzyPokemon.run(pokemon);

    if (!fuzzyResult.length) {
      const fuzzyAliasResult = new FuzzySearch(pokedexAliases, [ 'alias', 'name' ], { threshold: 0.4 }).run(pokemon);

      if (fuzzyAliasResult.length) {
        fuzzyResult = fuzzyPokemon.run(fuzzyAliasResult[0].name);
      }
    }

    if (!fuzzyResult.length) {
      throw new Error(`No Pokémon found ${pokemon}`);
    }

    if (reverse) {
      fuzzyResult.reverse();
    }

    const paginatedFuzzyResult = fuzzyResult.slice(skip, skip + take);

    for (const page of paginatedFuzzyResult) {
      const dexEntry = new DexEntry();

      const genderData = new GenderEntry();
      const baseStatsData = new StatsEntry();
      const abilitiesData = new AbilitiesEntry();
      const pageGenderRatio: Pokemon.DexEntry['genderRatio'] = page.genderRatio || {
        male: 0.5,
        female: 0.5,
        special: 'Unknown',
      };

      genderData.male = `${pageGenderRatio.male * 100}%`;
      genderData.female = `${pageGenderRatio.female * 100}%`;
      genderData.special = pageGenderRatio.special;

      baseStatsData.hp = page.baseStats.hp;
      baseStatsData.attack = page.baseStats.atk;
      baseStatsData.defense = page.baseStats.def;
      baseStatsData.specialattack = page.baseStats.spa;
      baseStatsData.specialdefense = page.baseStats.spd;
      baseStatsData.speed = page.baseStats.spe;

      abilitiesData.first = page.abilities.first;
      abilitiesData.second = page.abilities.second;
      abilitiesData.hidden = page.abilities.hidden;
      abilitiesData.special = page.abilities.special;

      dexEntry.abilities = abilitiesData;
      dexEntry.gender = genderData;
      dexEntry.baseStats = baseStatsData;
      dexEntry.num = page.num;
      dexEntry.species = page.species;
      dexEntry.types = page.types;
      dexEntry.color = page.color;
      dexEntry.eggGroups = page.eggGroups || undefined;
      dexEntry.evolutionLevel = page.evoLevel || undefined;
      dexEntry.evos = page.evos || undefined;
      dexEntry.prevo = page.prevo || undefined;
      dexEntry.forme = page.forme || undefined;
      dexEntry.formeLetter = page.formeLetter || undefined;
      dexEntry.height = page.heightm;
      dexEntry.weight = page.weightkg;
      dexEntry.baseForme = page.baseForme || undefined;
      dexEntry.baseSpecies = page.baseSpecies || undefined;
      dexEntry.otherFormes = page.otherFormes || undefined;

      queryResults.push(dexEntry);
    }

    return queryResults;
  }

  public async findBySpeciesWithDetails(@Args() {
    pokemon, skip, take, reverse,
  }: PokemonPaginatedArgs, parsingPokemon = '') {
    const basePokemonData = this.findBySpecies(pokemon);

    if (!basePokemonData) {
      throw new Error(`No Pokémon found for ${pokemon}`);
    }

    const [ flavorsImport, tiersImport ] = await Promise.all([
      import('../assets/flavorText.json'),
      import('../assets/formats.json')
    ]);

    const { default: flavors } = flavorsImport as { default: Record<string, Pokemon.FlavorText[]> };
    const { default: tiers } = tiersImport as { default: Record<string, string> };

    const pokemonData = new DexDetails();
    const genderData = new GenderEntry();
    const baseStatsData = new StatsEntry();
    const abilitiesData = new AbilitiesEntry();
    const evolutionChain: Promise<DexDetails>[] = [];
    const preevolutionChain: Promise<DexDetails>[] = [];
    const basePokemonGenderRatio: Pokemon.DexEntry['genderRatio'] = basePokemonData.genderRatio || {
      male: 0.5,
      female: 0.5,
      special: 'Unknown',
    };

    genderData.male = `${basePokemonGenderRatio.male * 100}%`;
    genderData.female = `${basePokemonGenderRatio.female * 100}%`;
    genderData.special = basePokemonGenderRatio.special;

    baseStatsData.hp = basePokemonData.baseStats.hp;
    baseStatsData.attack = basePokemonData.baseStats.atk;
    baseStatsData.defense = basePokemonData.baseStats.def;
    baseStatsData.specialattack = basePokemonData.baseStats.spa;
    baseStatsData.specialdefense = basePokemonData.baseStats.spd;
    baseStatsData.speed = basePokemonData.baseStats.spe;

    abilitiesData.first = basePokemonData.abilities.first;
    abilitiesData.second = basePokemonData.abilities.second;
    abilitiesData.hidden = basePokemonData.abilities.hidden;
    abilitiesData.special = basePokemonData.abilities.special;

    pokemonData.abilities = abilitiesData;
    pokemonData.gender = genderData;
    pokemonData.baseStats = baseStatsData;
    pokemonData.num = basePokemonData.num;
    pokemonData.species = basePokemonData.species;
    pokemonData.types = basePokemonData.types;
    pokemonData.color = basePokemonData.color;
    pokemonData.eggGroups = basePokemonData.eggGroups || undefined;
    pokemonData.evolutionLevel = basePokemonData.evoLevel || undefined;
    pokemonData.smogonTier = tiers[pokemon.replace(/([-% ])/gm, '')] || 'Undiscovered';
    pokemonData.height = basePokemonData.heightm;
    pokemonData.weight = basePokemonData.weightkg;
    pokemonData.baseForme = basePokemonData.baseForme;
    pokemonData.baseSpecies = basePokemonData.baseSpecies;
    pokemonData.otherFormes = basePokemonData.otherFormes;
    pokemonData.flavorTexts = [];
    pokemonData.sprite = `https://play.pokemonshowdown.com/sprites/ani/${Util.toLowerSingleWordCase(basePokemonData.species)}`;
    pokemonData.shinySprite = `https://play.pokemonshowdown.com/sprites/ani-shiny/${Util.toLowerSingleWordCase(basePokemonData.species)}`;
    pokemonData.bulbapediaPage = basePokemonData.num >= 1 ? this.parseSpeciesForBulbapedia(basePokemonData.species, basePokemonData.baseForme || basePokemonData.baseSpecies) : '';
    pokemonData.serebiiPage = basePokemonData.num >= 1 ? `https://www.serebii.net/pokedex-sm/${basePokemonData.num}.shtml` : '';
    pokemonData.smogonPage = basePokemonData.num >= 1 ? `https://www.smogon.com/dex/sm/pokemon/${Util.toLowerHyphenCase(basePokemonData.species)}` : '';

    if (basePokemonData.num >= 0) {
      if (basePokemonData.forme) {
        const formFlavors = flavors[`${basePokemonData.num}${basePokemonData.forme.toLowerCase()}`];
        for (const formFlavor of formFlavors) {
          const formFlavorEntry = new FlavorEntry();
          formFlavorEntry.game = formFlavor.version_id;
          formFlavorEntry.flavor = formFlavor.flavor_text;
          pokemonData.flavorTexts.push(formFlavorEntry);
        }
      } else {
        const baseFlavors = flavors[basePokemonData.num];
        for (const baseFlavor of baseFlavors) {
          const formFlavorEntry = new FlavorEntry();
          formFlavorEntry.game = baseFlavor.version_id;
          formFlavorEntry.flavor = baseFlavor.flavor_text;
          pokemonData.flavorTexts.push(formFlavorEntry);
        }
      }
    }

    if (reverse) {
      pokemonData.flavorTexts.reverse();
    }

    pokemonData.flavorTexts = pokemonData.flavorTexts.slice(skip, skip + take);

    if (basePokemonData.prevo && basePokemonData.prevo !== parsingPokemon) {
      const prevoPokemon = this.findBySpecies(basePokemonData.prevo);
      if (prevoPokemon) {
        preevolutionChain.push(this.findBySpeciesWithDetails({
          pokemon: prevoPokemon.species,
          skip,
          take,
          reverse,
        }, basePokemonData.species));
      }
    }

    if (basePokemonData.evos && basePokemonData.evos[0] !== parsingPokemon) {
      const evoPokemon = this.findBySpecies(basePokemonData.evos[0]);
      if (evoPokemon) {
        evolutionChain.push(this.findBySpeciesWithDetails({
          pokemon: evoPokemon.species,
          skip,
          take,
          reverse,
        }, basePokemonData.species));
      }
    }

    pokemonData.preevolutions = await Promise.all(preevolutionChain);
    pokemonData.evolutions = await Promise.all(evolutionChain);

    return pokemonData;
  }

  private parseSpeciesForBulbapedia(pokemonName: string, baseForme?: string) {
    if (baseForme) {
      pokemonName = Util.toTitleSnakeCase(baseForme);
    }

    return `https://bulbapedia.bulbagarden.net/wiki/${pokemonName}_(Pokemon)`;
  }
}