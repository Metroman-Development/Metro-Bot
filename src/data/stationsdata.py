import json
import sys

#Transporte, Servicios Generales, Accesibilidd, Comercio, Cultura, "link de imagen"

#estacion : ["transporte", "servicios", "accesibilidad","comercio", "cultura", "link"],

stationsSchematics = {

  "san pablo l1" : ["https://media.discordapp.net/attachments/792250794296606743/908383616168509490/unknown.png", "https://www.metro.cl/estacion/isometricas/san-pablo-l1.pdf"],

  "neptuno" : ["https://cdn.discordapp.com/attachments/792250794296606743/908384059812630538/unknown.png", "https://www.metro.cl/estacion/isometricas/neptuno.pdf"],

  "pajaritos" : ["https://media.discordapp.net/attachments/792250794296606743/908384804297388082/unknown.png", "https://www.metro.cl/estacion/isometricas/neptuno.pdf"],

  "las rejas": ["https://cdn.discordapp.com/attachments/792250794296606743/908419029084020796/unknown.png", "https://www.metro.cl/estacion/isometricas/las-rejas.pdf"],

  "ecuador": ["https://media.discordapp.net/attachments/792250794296606743/908419649950060544/unknown.png", "https://www.metro.cl/estacion/isometricas/ecuador.pdf"],

  "san alberto hurtado": ["https://cdn.discordapp.com/attachments/792250794296606743/908420052636794951/unknown.png", "https://www.metro.cl/estacion/isometricas/san-alberto-hurtado.pdf"],

  "universidad de santiago": ["https://cdn.discordapp.com/attachments/792250794296606743/908421584631504946/unknown.png", "https://www.metro.cl/estacion/isometricas/universidad-de-santiago.pdf"],

  "estacion central": ["https://media.discordapp.net/attachments/792250794296606743/908507324757471242/unknown.png", "https://www.metro.cl/estacion/isometricas/estacion-central.pdf", "Estación Central"],

  "union latinoamericana": ["https://media.discordapp.net/attachments/792250794296606743/908511398819147786/unknown.png", "https://www.metro.cl/estacion/isometricas/union-latinoamericana.pdf"],

  "republica": ["https://media.discordapp.net/attachments/792250794296606743/908512182357082162/unknown.png", "https://www.metro.cl/estacion/isometricas/republica.pdf"],

  "los heroes l1": ["https://media.discordapp.net/attachments/792250794296606743/908512877852368907/unknown.png", "https://www.metro.cl/estacion/isometricas/los-heroes-l1.pdf"],

  "la moneda": ["https://media.discordapp.net/attachments/792250794296606743/908712276729671710/unknown.png", "https://www.metro.cl/estacion/isometricas/la-moneda.pdf"],

  "universidad de chile l1": ["https://media.discordapp.net/attachments/792250794296606743/908712663561936896/unknown.png", "https://www.metro.cl/estacion/isometricas/universidad-de-chile.pdf"],

  "santa lucia": ["https://media.discordapp.net/attachments/792250794296606743/908713814952919080/unknown.png", "https://www.metro.cl/estacion/isometricas/santa-lucia.pdf"],

  "universidad catolica" : ["https://media.discordapp.net/attachments/792250794296606743/908715124011982888/unknown.png", "https://www.metro.cl/estacion/isometricas/universidad-catolica.pdf"],

  "baquedano l1" : ["https://media.discordapp.net/attachments/792250794296606743/908717439821418586/unknown.png", "https://www.metro.cl/estacion/isometricas/baquedano-l1.pdf"],

  "salvador" : ["https://media.discordapp.net/attachments/792250794296606743/908724445533843536/unknown.png", "https://www.metro.cl/estacion/isometricas/salvador.pdf"],

  "manuel montt" : ["https://media.discordapp.net/attachments/792250794296606743/908729960078913637/unknown.png", "https://www.metro.cl/estacion/isometricas/manuel-montt.pdf"],

  "pedro de valdivia": ["https://media.discordapp.net/attachments/792250794296606743/908814339480367114/unknown.png", "https://www.metro.cl/estacion/isometricas/pedro-de-valdivia.pdf"],

  "los leones l1": ["https://cdn.discordapp.com/attachments/792250794296606743/908845311810756648/unknown.png", "https://www.metro.cl/estacion/isometricas/los-leones.pdf"],

  "tobalaba l1" : ["https://media.discordapp.net/attachments/792250794296606743/908852087574638612/unknown.png", "https://www.metro.cl/estacion/isometricas/tobalaba-l1.pdf"],

  "el golf" : ["https://cdn.discordapp.com/attachments/792250794296606743/908854945858592818/unknown.png", "https://www.metro.cl/estacion/isometricas/el-golf.pdf"],

  "alcantara" : ["https://cdn.discordapp.com/attachments/792250794296606743/908858641543753828/unknown.png", "https://www.metro.cl/estacion/isometricas/alcantara.pdf"],

  "escuela militar" : ["https://cdn.discordapp.com/attachments/792250794296606743/908861555087642664/unknown.png", "https://www.metro.cl/estacion/isometricas/escuela-militar.pdf"],

  "manquehue" : ["https://cdn.discordapp.com/attachments/792250794296606743/908862981033590854/unknown.png", "https://www.metro.cl/estacion/isometricas/manquehue.pdf"],

  "hernando de magallanes" : ["https://cdn.discordapp.com/attachments/792250794296606743/908864996207902750/unknown.png", "https://www.metro.cl/estacion/isometricas/hernando-magallanes.pdf"],

  "los dominicos" : ["https://cdn.discordapp.com/attachments/792250794296606743/908867196510404608/unknown.png", "https://www.metro.cl/estacion/isometricas/los-dominicos.pdf"],

  "vespucio norte" : ["https://cdn.discordapp.com/attachments/792250794296606743/908852941748854835/unknown.png", "https://www.metro.cl/estacion/isometricas/vespucio-norte.pdf"],

  "zapadores" : ["https://cdn.discordapp.com/attachments/792250794296606743/908847634075226122/unknown.png", "https://www.metro.cl/estacion/isometricas/zapadores.pdf"],

  "dorsal" : ["https://media.discordapp.net/attachments/792250794296606743/908730783278174208/unknown.png", "https://www.metro.cl/estacion/isometricas/dorsal.pdf"],

  "einstein" : ["https://media.discordapp.net/attachments/792250794296606743/908726169829015632/unknown.png", "https://www.metro.cl/estacion/isometricas/einstein.pdf"],

  "cementerios" : ["https://media.discordapp.net/attachments/792250794296606743/908815987112022046/unknown.png?width=551&height=468", "https://www.metro.cl/estacion/isometricas/cementerios.pdf"],

  "cerro blanco" : ["https://media.discordapp.net/attachments/792250794296606743/908717992693600286/unknown.png", "https://www.metro.cl/estacion/isometricas/cerro-blanco.pdf"],

  "patronato" : ["https://media.discordapp.net/attachments/792250794296606743/908705942231744562/unknown.png", "https://www.metro.cl/estacion/isometricas/patronato.pdf"],

  "puente cal y canto l2" : ["https://media.discordapp.net/attachments/792250794296606743/908704471624876032/unknown.png", "https://www.metro.cl/estacion/isometricas/cal-y-canto.pdf"],

  "santa ana l2" : ["https://media.discordapp.net/attachments/792250794296606743/908700454949642240/unknown.png", "https://www.metro.cl/estacion/isometricas/santa-ana-l2.pdf"],

  "los heroes l2": ["https://media.discordapp.net/attachments/792250794296606743/908513078675644416/unknown.png", "https://www.metro.cl/estacion/isometricas/los-heroes-l2.pdf"],

  "toesca" : ["https://cdn.discordapp.com/attachments/792250794296606743/908705583333531708/unknown.png", "https://www.metro.cl/estacion/isometricas/toesca.pdf"],

  "parque ohiggins" : ["https://media.discordapp.net/attachments/792250794296606743/908719432971485224/unknown.png", "https://www.metro.cl/estacion/isometricas/parque-ohiggins.pdf"],

  "rondizzoni" : ["https://media.discordapp.net/attachments/792250794296606743/908726029516951552/unknown.png", "https://www.metro.cl/estacion/isometricas/rondizzoni.pdf"],

  "franklin l2" : ["https://media.discordapp.net/attachments/792250794296606743/908731134320459786/unknown.png", "https://www.metro.cl/estacion/isometricas/franklin.pdf"],

  "el llano" : ["https://media.discordapp.net/attachments/792250794296606743/908816329618915368/unknown.png", "https://www.metro.cl/estacion/isometricas/el-llano.pdf"],

  "san miguel" : ["https://cdn.discordapp.com/attachments/792250794296606743/908847926460174396/unknown.png", "https://www.metro.cl/estacion/isometricas/san-miguel.pdf"],

  "lo vial" : ["https://cdn.discordapp.com/attachments/792250794296606743/908852555436683334/unknown.png", "https://www.metro.cl/estacion/isometricas/lo-vial.pdf"],

  "departamental" : ["https://cdn.discordapp.com/attachments/792250794296606743/908855383664250960/unknown.png", "https://www.metro.cl/estacion/isometricas/departamental.pdf"],

  "ciudad del nino" : ["https://media.discordapp.net/attachments/792250794296606743/908858969353760808/unknown.png", "https://www.metro.cl/estacion/isometricas/ciudad-del-nino.pdf"],

  "lo ovalle" : ["https://cdn.discordapp.com/attachments/792250794296606743/908862070928322580/unknown.png", "https://www.metro.cl/estacion/isometricas/lo-ovalle.pdf", "La Cisterna"],

  "el parron" : ["https://cdn.discordapp.com/attachments/792250794296606743/908863331413159936/unknown.png", "https://www.metro.cl/estacion/isometricas/el-parron.pdf", "La Cisterna"],

  "la cisterna l2" : ["https://cdn.discordapp.com/attachments/792250794296606743/908865345111097454/unknown.png", "https://www.metro.cl/estacion/isometricas/la-cisterna-l2.pdf", "La Cisterna"],

  "los libertadores" : ["https://media.discordapp.net/attachments/792250794296606743/908849419187814470/unknown.png", "https://www.metro.cl/estacion/isometricas/los-libertadores.pdf"],

  "cardenal caro" : ["https://media.discordapp.net/attachments/792250794296606743/908816688487759883/unknown.png", "https://www.metro.cl/estacion/isometricas/cardenal-caro.pdf"],

  "vivaceta" : ["https://media.discordapp.net/attachments/792250794296606743/908732564037074974/unknown.png", "https://www.metro.cl/estacion/isometricas/vivaceta.pdf"],

  "conchali" : ["https://media.discordapp.net/attachments/792250794296606743/908727148985065493/unknown.png", "https://www.metro.cl/estacion/isometricas/conchali.pdf"],

  "plaza chacabuco" : ["https://media.discordapp.net/attachments/792250794296606743/908720346121777162/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-chacabuco.pdf"],

  "hospitales" : ["https://media.discordapp.net/attachments/792250794296606743/908710179078561842/unknown.png", "https://www.metro.cl/estacion/isometricas/hospitales.pdf"],

  "puente cal y canto l3" : ["https://media.discordapp.net/attachments/792250794296606743/908704860873060382/unknown.png", "https://www.metro.cl/estacion/isometricas/cal-y-canto-l3.pdf"],

  "plaza de armas l3" : ["https://media.discordapp.net/attachments/792250794296606743/908709265081004042/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-de-armas-l3.pdf"],

  "universidad de chile l3" : ["https://cdn.discordapp.com/attachments/792250794296606743/908711852568084480/unknown.png", "https://www.metro.cl/estacion/isometricas/universidad-de-chile-l3.pdf"],

  "parque almagro" : ["https://media.discordapp.net/attachments/792250794296606743/908713274554585088/unknown.png", "https://www.metro.cl/estacion/isometricas/parque-almagro.pdf"],

  "matta" : ["https://media.discordapp.net/attachments/792250794296606743/908722344099463208/unknown.png", "https://www.metro.cl/estacion/isometricas/matta.pdf"],

  "irarrazaval l3" : ["https://media.discordapp.net/attachments/792250794296606743/908727429072306216/unknown.png", "https://www.metro.cl/estacion/isometricas/irarrazaval-l3.pdf"],

  "monsenor eyzaguirre" : ["https://media.discordapp.net/attachments/792250794296606743/908732161601970216/unknown.png", "https://www.metro.cl/estacion/isometricas/monsenor-eyzaguirre.pdf"],

  "nunoa l3" : ["https://media.discordapp.net/attachments/792250794296606743/908817414811189278/unknown.png", "https://www.metro.cl/estacion/isometricas/nunoa-l3.pdf"],

  "chile espana" : ["https://media.discordapp.net/attachments/792250794296606743/908850027257032744/unknown.png", "https://www.metro.cl/estacion/isometricas/chile-espana.pdf"],

  "villa frei" : ["https://cdn.discordapp.com/attachments/792250794296606743/908853458805874718/unknown.png", "https://www.metro.cl/estacion/isometricas/villa-frei.pdf"],

  "plaza egana l3" : ["https://cdn.discordapp.com/attachments/792250794296606743/908856215705104424/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-egana-l3.pdf"],

  "fernando castillo velasco" : ["https://cdn.discordapp.com/attachments/792250794296606743/908859405590724638/unknown.png", "https://www.metro.cl/estacion/isometricas/fernando-castillo-velasco.pdf"],

  "tobalaba l4" : ["https://cdn.discordapp.com/attachments/792250794296606743/908851826403717150/unknown.png", "https://www.metro.cl/estacion/isometricas/tobalaba-l4.pdf"],

  "cristobal colon" : ["https://media.discordapp.net/attachments/792250794296606743/908854140229283890/unknown.png", "https://www.metro.cl/estacion/isometricas/cristobal-colon.pdf"],

  "francisco bilbao" : ["https://cdn.discordapp.com/attachments/792250794296606743/908856952124227594/unknown.png", "https://www.metro.cl/estacion/isometricas/francisco-bilbao.pdf"],

  "principe de gales" : ["https://cdn.discordapp.com/attachments/792250794296606743/908860018990915594/unknown.png", "https://www.metro.cl/estacion/isometricas/principe-de-gales.pdf"],

  "simon bolivar" : ["https://media.discordapp.net/attachments/792250794296606743/908857122673020978/unknown.png", "https://www.metro.cl/estacion/isometricas/simon-bolivar.pdf"],

  "grecia" : ["https://cdn.discordapp.com/attachments/792250794296606743/908861117399449600/unknown.png", "https://www.metro.cl/estacion/isometricas/grecia.pdf"],

  "plaza egana l4" : ["https://media.discordapp.net/attachments/792250794296606743/908856024662966302/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-egana.pdf"],

  "los orientales" : ["https://media.discordapp.net/attachments/792250794296606743/908857575217455134/unknown.png", "https://www.metro.cl/estacion/isometricas/los-orientales.pdf"],

  "los presidentes" : ["https://media.discordapp.net/attachments/792250794296606743/908862376680489011/unknown.png", "https://www.metro.cl/estacion/isometricas/los-presidentes.pdf"],

  "las torres" : ["https://cdn.discordapp.com/attachments/792250794296606743/908864139210936350/unknown.png", "https://www.metro.cl/estacion/isometricas/las-torres.pdf"],

  "macul" : ["https://cdn.discordapp.com/attachments/792250794296606743/908865928895295518/unknown.png", "https://www.metro.cl/estacion/isometricas/macul.pdf"],

  "vicuna mackenna l4" : ["https://cdn.discordapp.com/attachments/792250794296606743/908867496591888394/unknown.png", "https://www.metro.cl/estacion/isometricas/vicuna-mackenna-l4.pdf"],

  "vicente valdes l4" : ["https://cdn.discordapp.com/attachments/792250794296606743/908866748072210512/unknown.png", "https://www.metro.cl/estacion/isometricas/vicente-valdes-l4.pdf"],

  "rojas magallanes" : ["https://cdn.discordapp.com/attachments/792250794296606743/908869396502548530/unknown.png", "https://www.metro.cl/estacion/isometricas/rojas-magallanes.pdf"],

  "trinidad" : ["https://cdn.discordapp.com/attachments/792250794296606743/908869505411850280/unknown.png", "https://www.metro.cl/estacion/isometricas/trinidad.pdf"],

  "san jose de la estrella" : ["https://cdn.discordapp.com/attachments/792250794296606743/908869591923580968/unknown.png", "https://www.metro.cl/estacion/isometricas/san-jose-de-la-estrella.pdf"],

  "los quillayes" : ["https://cdn.discordapp.com/attachments/792250794296606743/908869677231525978/unknown.png", "https://www.metro.cl/estacion/isometricas/los-quillayes.pdf"],

  "elisa correa" : ["https://cdn.discordapp.com/attachments/792250794296606743/908869838313775144/unknown.png", "https://www.metro.cl/estacion/isometricas/elisa-correa.pdf"],

  "hospital sotero del rio" : ["https://cdn.discordapp.com/attachments/792250794296606743/908869943741784124/unknown.png", "https://www.metro.cl/estacion/isometricas/hospital-sotero-del-rio.pdf"],

  "protectora de la infancia" : ["https://cdn.discordapp.com/attachments/792250794296606743/908870029989249064/unknown.png", "https://www.metro.cl/estacion/isometricas/protectora-de-la-infancia.pdf"],

  "las mercedes" : ["https://cdn.discordapp.com/attachments/792250794296606743/908870141469667328/unknown.png", "https://www.metro.cl/estacion/isometricas/las-mercedes.pdf"],

  "plaza de puente alto" : ["https://cdn.discordapp.com/attachments/792250794296606743/908870285791494234/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-puente-alto.pdf"],

  "la cisterna l4a" : ["https://cdn.discordapp.com/attachments/792250794296606743/908865628440522762/unknown.png", "https://www.metro.cl/estacion/isometricas/la-cisterna-l4a.pdf"],

  "san ramon" : ["https://cdn.discordapp.com/attachments/792250794296606743/908866201160151080/unknown.png", "https://www.metro.cl/estacion/isometricas/san-ramon.pdf"],

  "santa rosa" : ["https://cdn.discordapp.com/attachments/792250794296606743/908871734575370240/unknown.png", "https://www.metro.cl/estacion/isometricas/santa-rosa.pdf"],

  "la granja" : ["https://cdn.discordapp.com/attachments/792250794296606743/908871634444746752/unknown.png", "https://www.metro.cl/estacion/isometricas/la-granja.pdf"],

  "santa julia" : ["https://cdn.discordapp.com/attachments/792250794296606743/908871501871214652/unknown.png", "https://www.metro.cl/estacion/isometricas/santa-julia.pdf"],

  "vicuna mackenna l4a" : ["https://cdn.discordapp.com/attachments/792250794296606743/908867760862400554/unknown.png", "https://www.metro.cl/estacion/isometricas/vicuna-mackenna-l4a.pdf"],

  "plaza de maipu" : ["https://media.discordapp.net/attachments/792250794296606743/902351250824261632/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-maipu.pdf"],

  "santiago bueras" : ["https://media.discordapp.net/attachments/792250794296606743/902351473533407232/unknown.png", "https://www.metro.cl/estacion/isometricas/santiago-bueras.pdf"],

  "del sol" : ["https://cdn.discordapp.com/attachments/792250794296606743/902352156999438386/unknown.png", "https://www.metro.cl/estacion/isometricas/del-sol.pdf"],

  "monte tabor" : ["https://media.discordapp.net/attachments/792250794296606743/908703129879580672/unknown.png", "https://www.metro.cl/estacion/isometricas/las-parcelas.pdf"],

  "las parcelas" : ["https://media.discordapp.net/attachments/792250794296606743/908703129879580672/unknown.png", "https://www.metro.cl/estacion/isometricas/las-parcelas.pdf"],

  "laguna sur" : ["https://cdn.discordapp.com/attachments/792250794296606743/908702776534634566/unknown.png", "https://www.metro.cl/estacion/isometricas/laguna-sur.pdf"],

  "barrancas" : ["https://media.discordapp.net/attachments/792250794296606743/908702330667560970/unknown.png", "https://www.metro.cl/estacion/isometricas/barrancas.pdf"],

  "pudahuel" : ["https://cdn.discordapp.com/attachments/792250794296606743/908701842739974154/unknown.png", "https://www.metro.cl/estacion/isometricas/pudahuel.pdf"],

  "san pablo l5" : ["https://media.discordapp.net/attachments/792250794296606743/908384392563535933/unknown.png", "https://www.metro.cl/estacion/isometricas/san-pablo-l5.pdf"],

  "lo prado" : ["https://media.discordapp.net/attachments/792250794296606743/908692168514887700/unknown.png", "https://www.metro.cl/estacion/isometricas/lo-prado.pdf"],

  "blanqueado" : ["https://media.discordapp.net/attachments/792250794296606743/908698562026676274/unknown.png", "https://www.metro.cl/estacion/isometricas/blanqueado.pdf"],

  "gruta de lourdes" : ["https://media.discordapp.net/attachments/792250794296606743/908698786342264852/unknown.png", "https://www.metro.cl/estacion/isometricas/gruta-de-lourdes.pdf"],

  "quinta normal" : ["https://media.discordapp.net/attachments/792250794296606743/908699194833911828/unknown.png", "https://www.metro.cl/estacion/isometricas/quinta-normal.pdf"],

  "cumming" : ["https://media.discordapp.net/attachments/792250794296606743/908699562510786570/unknown.png", "https://www.metro.cl/estacion/isometricas/cumming.pdf"],

  "santa ana l5" : ["https://media.discordapp.net/attachments/792250794296606743/908699944569946132/unknown.png", "https://www.metro.cl/estacion/isometricas/santa-ana-l5.pdf"],

  "plaza de armas l5" : ["https://media.discordapp.net/attachments/792250794296606743/908709572892586035/unknown.png", "https://www.metro.cl/estacion/isometricas/plaza-de-armas.pdf"],

  "bellas artes" : ["https://cdn.discordapp.com/attachments/792250794296606743/908714575233437716/unknown.png", "https://www.metro.cl/estacion/isometricas/bellas-artes.pdf"],

  "baquedano l5" : ["https://media.discordapp.net/attachments/792250794296606743/908717165224538182/unknown.png", "https://www.metro.cl/estacion/isometricas/baquedano-l5.pdf"],

  "parque bustamante" : ["https://media.discordapp.net/attachments/792250794296606743/908724041601396787/unknown.png", "https://www.metro.cl/estacion/isometricas/parque-bustamante.pdf"],

  "santa isabel" : ["https://media.discordapp.net/attachments/792250794296606743/908727745603833926/unknown.png", "https://www.metro.cl/estacion/isometricas/santa-isabel.pdf"],

  "irarrazaval l5" : ["https://media.discordapp.net/attachments/792250794296606743/908727937296130088/unknown.png", "https://www.metro.cl/estacion/isometricas/irarrazaval.pdf"],

  "nuble l5" : ["https://media.discordapp.net/attachments/792250794296606743/908733520833310870/unknown.png", "https://www.metro.cl/estacion/isometricas/nuble.pdf"],

  "rodrigo de araya" : ["https://media.discordapp.net/attachments/792250794296606743/908841753069649930/unknown.png", "https://www.metro.cl/estacion/isometricas/rodrigo-de-araya.pdf", "San Joaquín"],

  "carlos valdovinos" : ["https://media.discordapp.net/attachments/792250794296606743/908850391691694170/unknown.png", "https://www.metro.cl/estacion/isometricas/carlos-valdovinos.pdf"],

  "camino agricola" : ["https://cdn.discordapp.com/attachments/792250794296606743/908854430177312788/unknown.png", "https://www.metro.cl/estacion/isometricas/camino-agricola.pdf"],

  "san joaquin" : ["https://cdn.discordapp.com/attachments/792250794296606743/908857970920661012/unknown.png", "https://www.metro.cl/estacion/isometricas/san-joaquin.pdf"],

  "pedrero" : ["https://cdn.discordapp.com/attachments/792250794296606743/908860904521744434/unknown.png", "https://www.metro.cl/estacion/isometricas/pedrero.pdf"],

  "mirador" : ["https://cdn.discordapp.com/attachments/792250794296606743/908862787067994112/unknown.png", "https://www.metro.cl/estacion/isometricas/mirador.pdf"],

  "bellavista de la florida" : ["https://cdn.discordapp.com/attachments/792250794296606743/908864624676454451/unknown.png", "https://www.metro.cl/estacion/isometricas/bellavista-de-la-florida.pdf"],

  "vicente valdes l5" : ["https://cdn.discordapp.com/attachments/792250794296606743/908866506895527996/unknown.png", "https://www.metro.cl/estacion/isometricas/vicente-valdes-l5.pdf"],

  "cerrillos" : ["https://cdn.discordapp.com/attachments/792250794296606743/908851111916630056/unknown.png", "https://www.metro.cl/estacion/isometricas/cerrillos.pdf"],

  "lo valledor" : ["https://media.discordapp.net/attachments/792250794296606743/908842183107424266/unknown.png", "https://www.metro.cl/estacion/isometricas/lo-valledor.pdf"],

  "pedro aguirre cerda" : ["https://media.discordapp.net/attachments/792250794296606743/908734729078063104/unknown.png", "https://www.metro.cl/estacion/isometricas/pedro-aguirre-cerda.pdf"],

  "franklin l6" : ["https://media.discordapp.net/attachments/792250794296606743/908731411211628544/unknown.png", "https://www.metro.cl/estacion/isometricas/franklin-l6.pdf"],

  "bio bio" : ["https://cdn.discordapp.com/attachments/792250794296606743/908734415256039564/unknown.png", "https://www.metro.cl/estacion/isometricas/bio-bio.pdf"],

  "nuble l6" : ["https://media.discordapp.net/attachments/792250794296606743/908733806477996032/unknown.png", "https://www.metro.cl/estacion/isometricas/nuble-l6.pdf"],

  "estadio nacional" : ["https://media.discordapp.net/attachments/792250794296606743/908735053641711636/unknown.png", "https://www.metro.cl/estacion/isometricas/estadio-nacional.pdf"],

  "nunoa l6" : ["https://media.discordapp.net/attachments/792250794296606743/908817690339192882/unknown.png", "https://www.metro.cl/estacion/isometricas/nunoa-l6.pdf"],

  "ines de suarez" : ["https://cdn.discordapp.com/attachments/792250794296606743/908842556706660352/unknown.png", "https://www.metro.cl/estacion/isometricas/ines-de-suarez.pdf"],

  "los leones l6" : ["https://media.discordapp.net/attachments/792250794296606743/908843419131080764/unknown.png", "https://www.metro.cl/estacion/isometricas/los-leones-l6.pdf"]


}




# Combine all data into a single dictionary
data = {
    "schematics": stationsSchematics,
    "staticData": stationsData
}



# Function to generate a JSON file

def generate_json_file():

    # Define the JSON file name

    file_name = "stationsdata.json"

    # Write the data to the JSON file

    with open(file_name, "w") as json_file:

        json.dump(data, json_file, indent=4)

    print(f"JSON file '{file_name}' has been generated successfully.")

# Call the function to generate the JSON file


 generate_json_file()
