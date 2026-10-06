using System.Web.Mvc;
using System.Web.Routing;

namespace FastFoodWeb
{
    public class RouteConfig
    {
        public static void RegisterRoutes(RouteCollection routes)
        {
            routes.IgnoreRoute("{resource}.axd/{*pathInfo}");

            // Định tuyến mặc định: Controller = Shop, Action = Index
            routes.MapRoute(
                name: "Default",
                url: "{controller}/{action}/{id}",
                defaults: new { controller = "Shop", action = "Index", id = UrlParameter.Optional }
            );
        }
    }
}
